var gamingPlatform;
(function (gamingPlatform) {
    var chat;
    (function (chat) {
        var GameChatController = (function () {
            function GameChatController($log_, $timeout_, $mdToast_, firebase_) {
                var _this = this;
                this.$log_ = $log_;
                this.$timeout_ = $timeout_;
                this.$mdToast_ = $mdToast_;
                this.firebase_ = firebase_;
                this.user = null;
                this.messages = [];
                this.currentMessageText = '';
                this.connected = false;
                this.msgAddedListener_ = function (data) {
                    _this.messages.push(data.val());
                    // HACK: This is pretty terrible
                    // TODO: Refactor holy shit
                    _this.$timeout_(function () {
                        _this.chatMessagesEl_.scrollTop = _this.chatMessagesEl_.scrollHeight;
                    }, 20);
                };
                this.gotFirstConnection_ = false;
                this.connectionListener_ = function (data) {
                    var isConnected = data.val();
                    var wasPreviouslyDisconnected = _this.gotFirstConnection_ && !_this.connected && isConnected;
                    if (isConnected && !_this.gotFirstConnection_) {
                        _this.gotFirstConnection_ = true;
                    }
                    _this.connected = isConnected;
                    if (wasPreviouslyDisconnected) {
                        _this.showConnectionMsg_('Connection re-established. You are back online.');
                    }
                    else if (!_this.connected && _this.gotFirstConnection_) {
                        _this.showConnectionMsg_('Connection lost. You can still post messages while offline.');
                    }
                };
                // HACK: Needed to update scrollTop for chat messages;
                this.chatMessagesEl_ = document.querySelector('.game-chat-messages');
            }
            GameChatController.prototype.$onInit = function () {
                var _this = this;
                this.firebase_.auth().onAuthStateChanged(function (user) {
                    _this.$log_.debug('User set to', user);
                    _this.user = user;
                });
                this.getConnectionRef_().on('value', this.connectionListener_);
                this.getMsgsRef_().on('child_added', this.msgAddedListener_);
                // Load initial messages into chat.
                this.getMsgsRef_().orderByChild('created').limitToLast(250);
            };
            GameChatController.prototype.$onDestroy = function () {
                // NOTE: There does not seem to be a listener removal for onAuthStateChanged.
                this.getConnectionRef_().off('value', this.connectionListener_);
                this.getMsgsRef_().off('child_added', this.msgAddedListener_);
            };
            GameChatController.prototype.attemptLogin = function () {
                var _this = this;
                var provider = new firebase.auth.GoogleAuthProvider();
                // NOTE: We don't call .then() here because this is handled by onAuthStateChanged;
                this.firebase_.auth().signInWithPopup(provider).catch(function (err) {
                    var errorIsOk = err.code === 'auth/popup-closed-by-user';
                    if (errorIsOk) {
                        return;
                    }
                    _this.$log_.error(err);
                });
            };
            GameChatController.prototype.addMessage = function () {
                if (!this.currentMessageText) {
                    return;
                }
                var _a = this.user, displayName = _a.displayName, photoURL = _a.photoURL;
                this.getMsgsRef_().push({
                    created: Date.now(),
                    text: this.currentMessageText,
                    user: {
                        displayName: displayName,
                        photoURL: photoURL
                    }
                });
                this.currentMessageText = '';
            };
            GameChatController.prototype.showConnectionMsg_ = function (msg) {
                var toast = this.$mdToast_.simple()
                    .textContent(msg)
                    .position('bottom right');
                this.$mdToast_.show(toast);
            };
            GameChatController.prototype.getMsgsRef_ = function () {
                return this.firebase_.database().ref('messages');
            };
            GameChatController.prototype.getConnectionRef_ = function () {
                return this.firebase_.database().ref('.info/connected');
            };
            GameChatController.$inject = ['$log', '$timeout', '$mdToast', 'firebase'];
            return GameChatController;
        }());
        chat.module.component('gameChat', {
            template: "\n      <style>\n        game-chat {\n          height: 100%;\n          position: relative;\n        }\n\n        .game-chat-login {\n          position: absolute;\n          left: 0;\n          top: 0;\n          width: 100%;\n          height: 100%;\n          background: rgba(255, 255, 255, .12);\n          display: flex;\n          align-items: center;\n          justify-content: center;\n          height: 100%;\n        }\n\n        .game-chat-panel {\n          transition: opacity 150ms cubic-bezier(.4, 0, .2, 1);\n        }\n\n        .game-chat-panel.inactive {\n          opacity: .6;\n          pointer-events: none;\n        }\n\n        .game-chat-panel.offline {\n          opacity: .8;\n        }\n\n        .game-chat-input-form {\n          margin: 0;\n          border-top: 1px solid rgba(255, 255, 255, .3);\n        }\n\n        .game-chat-messages {\n          padding-bottom: 0;\n          overflow-y: scroll;\n          margin-bottom: 8px;\n        }\n\n        .chat-input-container {\n          margin-top: 8px;\n          margin-left: 4px;\n        }\n\n        .chat-avatar {\n          border-radius: 50%;\n          border: 1px solid rgba(255, 255, 255, .3);\n        }\n\n        .chat-input {\n          margin: 0;\n        }\n\n        .msg-timestamp {\n          /* Hint text color */\n          color: rgba(255, 255, 255, .5);\n        }\n      </style>\n      <div class=\"game-chat-login\" ng-show=\"!$ctrl.user\">\n        <md-button class=\"md-raised md-primary\" ng-click=\"$ctrl.attemptLogin()\">Login with Google to Chat</md-button>\n      </div>\n      <div class=\"game-chat-panel\" layout=\"column\" ng-class=\"{'inactive': !$ctrl.user, 'offline': !$ctrl.connected}\">\n        <md-list class=\"game-chat-messages\" flex=\"90\">\n          <md-list-item class=\"msg md-2-line\" ng-repeat=\"msg in $ctrl.messages\">\n            <img src=\"{{msg.user.photoURL}}\" alt=\"Photo of {{msg.user.displayName}}\" class=\"md-avatar\">\n            <div class=\"md-list-item-text\" layout=\"column\">\n              <p>{{msg.user.displayName}}</p>\n              <p>{{msg.text}}</p>\n            </div>\n            <div class=\"md-secondary md-caption msg-timestamp\">{{msg.created|date:'medium'}}</div>\n          </md-list-item>\n        </md-list>\n        <form name=\"newmsg\" class=\"game-chat-input-form\" ng-submit=\"$ctrl.addMessage()\" flex>\n          <div class=\"chat-input-container\" layout layout-align=\"start center\">\n            <img ng-if=\"$ctrl.user\"\n                 class=\"chat-avatar\"\n                 src=\"{{$ctrl.user.photoURL}}\"\n                 width=\"48\"\n                 height=\"48\"\n                 alt=\"Photo of {{$ctrl.user.displayName}}\">\n            <md-input-container class=\"chat-input\" md-no-float flex layout layout-align=\"center center\">\n              <input type=\"text\" ng-model=\"$ctrl.currentMessageText\"\n                     md-no-asterisk aria-label=\"Type a message\" placeholder=\"Type a message...\"\n                     autocomplete=\"off\">\n            </md-input-container>\n          </div>\n        </form>\n      </div>\n    ",
            controller: GameChatController
        });
    })(chat = gamingPlatform.chat || (gamingPlatform.chat = {}));
})(gamingPlatform || (gamingPlatform = {}));
//# sourceMappingURL=game-chat.component.js.map