namespace gamingPlatform.chat {
  type Timestamp = number;
  type FirebaseDBListener = (a: firebase.database.DataSnapshot, b?: string) => any;

  interface ChatMessage {
    created: Timestamp,
    text: string,
    user: {
      displayName: string,
      photoURL: string
    }
  }

  class GameChatController {
    static $inject: string[] = ['$log', '$timeout', '$mdToast', 'firebase'];

    user: firebase.User = null;
    messages: ChatMessage[] = [];
    currentMessageText: string = '';
    connected: boolean = false;

    private msgAddedListener_: FirebaseDBListener = data => {
      this.messages.push(data.val())
      // HACK: This is pretty terrible
      // TODO: Refactor holy shit
      this.$timeout_(() => {
        this.chatMessagesEl_.scrollTop = this.chatMessagesEl_.scrollHeight;
      }, 20);
    };
    private gotFirstConnection_ = false;
    private connectionListener_: FirebaseDBListener = data => {
      const isConnected = data.val();
      const wasPreviouslyDisconnected = this.gotFirstConnection_ && !this.connected && isConnected;
      if (isConnected && !this.gotFirstConnection_) {
        this.gotFirstConnection_ = true;
      }

      this.connected = isConnected;
      if (wasPreviouslyDisconnected) {
        this.showConnectionMsg_('Connection re-established. You are back online.');
      } else if (!this.connected && this.gotFirstConnection_) {
        this.showConnectionMsg_('Connection lost. You can still post messages while offline.');
      }
    }
    // HACK: Needed to update scrollTop for chat messages;
    private chatMessagesEl_ = <HTMLElement>document.querySelector('.game-chat-messages');

    constructor(
      private $log_: angular.ILogService,
      private $timeout_: angular.ITimeoutService,
      private $mdToast_: angular.material.IToastService,
      private firebase_: firebase.app.App
    ) {}

    $onInit() {
      this.firebase_.auth().onAuthStateChanged((user: firebase.User) => {
        this.$log_.debug('User set to', user);
        this.user = user;
      });

      this.getConnectionRef_().on('value', this.connectionListener_);
      this.getMsgsRef_().on('child_added', this.msgAddedListener_);
      // Load initial messages into chat.
      this.getMsgsRef_().orderByChild('created').limitToLast(250);
    }

    $onDestroy() {
      // NOTE: There does not seem to be a listener removal for onAuthStateChanged.
      this.getConnectionRef_().off('value', this.connectionListener_);
      this.getMsgsRef_().off('child_added', this.msgAddedListener_);
    }

    attemptLogin() {
      const provider = new firebase.auth.GoogleAuthProvider();
      // NOTE: We don't call .then() here because this is handled by onAuthStateChanged;
      this.firebase_.auth().signInWithPopup(provider).catch((err: any) => {
        const errorIsOk = err.code === 'auth/popup-closed-by-user';
        if (errorIsOk) {
          return;
        }
        this.$log_.error(err)
      });
    }

    addMessage() {
      if (!this.currentMessageText) {
        return;
      }
      const {displayName, photoURL} = this.user;
      this.getMsgsRef_().push({
        created: Date.now(),
        text: this.currentMessageText,
        user: {
          displayName,
          photoURL
        }
      });
      this.currentMessageText = '';
    }

    showConnectionMsg_(msg: string) {
      const toast = this.$mdToast_.simple()
        .textContent(msg)
        .position('bottom right');
      this.$mdToast_.show(toast);
    }

    getMsgsRef_() {
      return this.firebase_.database().ref('messages');
    }

    getConnectionRef_() {
      return this.firebase_.database().ref('.info/connected');
    }
  }

  module.component('gameChat', {
    template: `
      <style>
        game-chat {
          height: 100%;
          position: relative;
        }

        .game-chat-login {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, .12);
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .game-chat-panel {
          transition: opacity 150ms cubic-bezier(.4, 0, .2, 1);
        }

        .game-chat-panel.inactive {
          opacity: .6;
          pointer-events: none;
        }

        .game-chat-panel.offline {
          opacity: .8;
        }

        .game-chat-input-form {
          margin: 0;
          border-top: 1px solid rgba(255, 255, 255, .3);
        }

        .game-chat-messages {
          padding-bottom: 0;
          overflow-y: scroll;
          margin-bottom: 8px;
        }

        .chat-input-container {
          margin-top: 8px;
          margin-left: 4px;
        }

        .chat-avatar {
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, .3);
        }

        .chat-input {
          margin: 0;
        }

        .msg-timestamp {
          /* Hint text color */
          color: rgba(255, 255, 255, .5);
        }
      </style>
      <div class="game-chat-login" ng-show="!$ctrl.user">
        <md-button class="md-raised md-primary" ng-click="$ctrl.attemptLogin()">Login with Google to Chat</md-button>
      </div>
      <div class="game-chat-panel" layout="column" ng-class="{'inactive': !$ctrl.user, 'offline': !$ctrl.connected}">
        <md-list class="game-chat-messages" flex="90">
          <md-list-item class="msg md-2-line" ng-repeat="msg in $ctrl.messages">
            <img src="{{msg.user.photoURL}}" alt="Photo of {{msg.user.displayName}}" class="md-avatar">
            <div class="md-list-item-text" layout="column">
              <p>{{msg.user.displayName}}</p>
              <p>{{msg.text}}</p>
            </div>
            <div class="md-secondary md-caption msg-timestamp">{{msg.created|date:'medium'}}</div>
          </md-list-item>
        </md-list>
        <form name="newmsg" class="game-chat-input-form" ng-submit="$ctrl.addMessage()" flex>
          <div class="chat-input-container" layout layout-align="start center">
            <img ng-if="$ctrl.user"
                 class="chat-avatar"
                 src="{{$ctrl.user.photoURL}}"
                 width="48"
                 height="48"
                 alt="Photo of {{$ctrl.user.displayName}}">
            <md-input-container class="chat-input" md-no-float flex layout layout-align="center center">
              <input type="text" ng-model="$ctrl.currentMessageText"
                     md-no-asterisk aria-label="Type a message" placeholder="Type a message..."
                     autocomplete="off">
            </md-input-container>
          </div>
        </form>
      </div>
    `,
    controller: GameChatController
  });
}
