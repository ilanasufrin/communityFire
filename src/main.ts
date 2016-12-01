namespace gamingPlatform {
  interface IMove {
    endMatchScores: number[];
    turnIndexAfterMove: number;
    stateAfterMove: any;
  }
  interface IStateTransition {
    turnIndexBeforeMove: number;
    stateBeforeMove: any;
    numberOfPlayers: number;
    move: IMove;
  }
  interface IPlayerInfo {
    avatarImageUrl: string;
    displayName: string;
    playerId: string;
  }
  interface ICommonUI extends IStateTransition {
    // -2 is a viewer; otherwise it's the player index (0/1).
    yourPlayerIndex: number;
  }
  // Proposals are used in community games: each player may submit a proposal, and the game will eventual selected
  // the winning proposal and convert it to a move.
  interface ICommunityUI extends ICommonUI {
    // You need to know your playerId to make sure you only make one proposal,
    // i.e., if (playerIdToProposal[yourPlayerId]) then you can't make another proposal.
    yourPlayerInfo: IPlayerInfo;
    // Mapping playerId to his proposal.
    playerIdToProposal: IProposals;
  }
  interface IProposal {
    playerInfo: IPlayerInfo; // the player making the proposal.
    chatDescription: string; // string representation of the proposal that will be shown in the community game chat.
    data: any; // IProposalData must be defined by the game.
  }
  interface IProposals {
    [playerId: string]: IProposal;
  }

  interface MyPlayerInfo extends IPlayerInfo {
    myCommunityPlayerIndex: number;
  }

  interface ICommunityMatch extends IStateTransition {
    matchName: string;
    playerIdToProposal: IProposals;
  }

  export let $rootScope: angular.IScope;
  export let $location: angular.ILocationService;
  export let $timeout: angular.ITimeoutService;
  export let $interval: angular.IIntervalService;
  export let $sce: angular.ISCEService;
  export let $interpolate: angular.IInterpolateService;
  export let $http: angular.IHttpService;
  export let $route: angular.route.IRouteService;

  export namespace main {
    export function getIframeSourceURL() {
      const PROD_URL = 'https://ilanasufrin.github.io/Simon'
      const hostname = $location.host();
      const isDev = Boolean(~[
        'localhost',
        '0.0.0.0',
        '127.0.0.1'
      ].indexOf(hostname));
      return $sce.trustAsResourceUrl(isDev ? `http://${hostname}:8081/` : PROD_URL);
    }

    // ----------------------------------------

    export let matches: ICommunityMatch[] = [];
    // Saving as json because firebase has restriction on keys (and we use "data: any").
    // Example error: Firebase.set failed: First argument  contains an invalid key (playerId0.5446834512026781) in property 'matches.0.playerIdToProposal'.  Keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]"
    // Another weird thing: For some reason firebase stores "{}" as null (for playerIdToProposal).
    let matchesRef = firebase.database().ref("matchesJson");
    matchesRef.on('value', function(snapshot: any) {
      $timeout(() => {
        let matchesJson = snapshot.val();
        if (!matchesJson) {
          matches = createCommunityMatches();
          storeMatches();
        } else {
          matches = angular.fromJson(matchesJson);
          if (showGameIframe()) sendCommunityUI();
        }
      });
    });

    export let myPlayerInfo: MyPlayerInfo = getMyPlayerInfo();
    log.alwaysLog("myPlayerInfo=", myPlayerInfo);

    function getMyPlayerInfo() {
      let myPlayerInfoJson = localStorage.getItem("myPlayerInfoJson");
      if (myPlayerInfoJson) return angular.fromJson(myPlayerInfoJson);
      myPlayerInfo = {
        avatarImageUrl: "http://graph.facebook.com/10154287448416125/picture?square=square",
        displayName: "Guest player " + (1 + Math.floor(999 * Math.random())),
        myCommunityPlayerIndex:
        location.search.indexOf('playBlack') != -1 ? 0 :
          location.search.indexOf('playWhite') != -1 ? 1 :
            Math.random() > 0.5 ? 0 : 1,
        playerId: "playerId" + Math.floor(1000000 * Math.random()),
      };
      localStorage.setItem("myPlayerInfoJson", angular.toJson(myPlayerInfo));
      return myPlayerInfo;
    }

    function storeMatches() {
      matchesRef.set(angular.toJson(matches));
    }

    function createCommunityMatches(): ICommunityMatch[] {
      return [
        createCommunityMatch("Greendale"),
        createCommunityMatch("Walla Walla"),
        createCommunityMatch("Santa Barbara"),
        createCommunityMatch("Valencia"),
      ];
    }
    function createCommunityMatch(matchName: string): ICommunityMatch {
      return {
        matchName: matchName,
        numberOfPlayers: 2,
        stateBeforeMove: null,
        turnIndexBeforeMove: 0,
        move: {
          endMatchScores: null,
          turnIndexAfterMove: 0,
          stateAfterMove: null,
        },
        playerIdToProposal: {},
      };
    }

    export function isInPage(page: string): boolean {
      if (page.charAt(0) !== '/') {
        throw new Error("page must start with '/', but got page=" + page);
      }
      return location.hash.indexOf('#' + page) === 0;
    }

    function isInPagePlayGame(): boolean {
      return true
    }

    export function showGameIframe(): boolean {
      return isInPagePlayGame() && messageSender.didGetGameReady();
    }

    export function changePage(hash: string): void {
      let currentLocation = location.hash.substring(1); // to remove "#"
      log.info("changePage from " + currentLocation + " to " + hash);
      if (currentLocation === hash) {
        return;
      }
      $location.path(hash);
      window.scrollTo(0, 0);
    }

    export function gotoPlayPage(matchIndex: number) {
      changePage('/playGame/' + matchIndex);
    }

    export function isYourTurn(match: ICommunityMatch) {
      return match.move.turnIndexAfterMove == myPlayerInfo.myCommunityPlayerIndex &&
        !match.playerIdToProposal[myPlayerInfo.playerId];
    }

    let currentMatchIndex: number = null;
    export function loadMatch(matchIndex: number) {
      let match = matches[matchIndex];
      if (!match) {
        log.warn("Couldn't find matchIndex=", matchIndex);
        changePage('/main');
        return;
      }
      currentMatchIndex = matchIndex;
      sendCommunityUI();
    }

    let lastCommunityUI: ICommunityUI = null;
    function sendCommunityUI() {
      let match = matches[currentMatchIndex];
      let communityUI: ICommunityUI = {
        yourPlayerIndex: myPlayerInfo.myCommunityPlayerIndex,
        yourPlayerInfo: myPlayerInfo,
        playerIdToProposal: match.playerIdToProposal,
        numberOfPlayers: match.numberOfPlayers,
        stateBeforeMove: match.stateBeforeMove,
        turnIndexBeforeMove: match.turnIndexBeforeMove,
        move: match.move,
      }
      log.info("sendCommunityUI: ", communityUI);
      lastCommunityUI = communityUI;
      messageSender.sendToGame({ communityUI: communityUI });
    }

    window.addEventListener("message", function(event) {
      let game_iframe: HTMLIFrameElement = <HTMLIFrameElement>window.document.getElementById("game_iframe");
      if (!game_iframe || game_iframe.contentWindow !== event.source) {
        return;
      }
      $rootScope.$apply(function() {
        let message = event.data;
        log.info("Platform got message:", message);
        if (message.gameReady) {
          if (messageSender.didGetGameReady()) {
            log.warn("Game sent gameReady before (look at the logs)! You can only send gameReady once.");
            return;
          }
          messageSender.gotGameReady();
          return;
        }

        // {communityMove: { proposal: proposal, move: move, lastCommunityUI: lastCommunityUI }
        let communityMove: any = message.communityMove;
        if (!communityMove) {
          log.info("Not a communityMove!");
          return;
        }
        if (!angular.equals(communityMove.lastCommunityUI, lastCommunityUI)) {
          log.error("This move belongs to an old communityUI! lastCommunityUI=\n" +
            angular.toJson(lastCommunityUI, true) + " communityMove.lastCommunityUI=\n" +
            angular.toJson(communityMove.lastCommunityUI, true));
          return;
        }
        let proposal: IProposal = communityMove.proposal;
        let move: IMove = communityMove.move;

        let match = matches[currentMatchIndex];
        // TODO: add proposal.chatDescription + proposal.playerInfo (avatar+displayName) to the group chat.
        if (move) {
          match.turnIndexBeforeMove = match.move.turnIndexAfterMove;
          match.stateBeforeMove = match.move.stateAfterMove;
          match.playerIdToProposal = {};
          match.move = move;
        } else {
          match.playerIdToProposal[myPlayerInfo.playerId] = proposal;
        }
        storeMatches();
        sendCommunityUI();
      });
    });

    angular.module('MyApp', ['ngMaterial', 'ngRoute', gamingPlatform.chat.module.name])
      .config(['$routeProvider', '$mdThemingProvider', function(
          $routeProvider: angular.route.IRouteProvider, $mdThemingProvider: angular.material.IThemingProvider) {
        $routeProvider.
          when('/', {
            templateUrl: 'html-templates/mainPage.html',
            controller: ''
          }).
          otherwise({
            redirectTo: '/'
          });

        $mdThemingProvider
          .theme('default')
          .primaryPalette('green')
          .accentPalette('orange')
          .dark();
      }])
      .run([
        '$timeout', '$interval',
        '$interpolate',
        '$http',
        '$location',
        '$rootScope',
        '$route',
        '$sce',
        '$templateCache',
        function(
          _timeout: angular.ITimeoutService, _interval: angular.IIntervalService,
          _interpolate: angular.IInterpolateService,
          _http: angular.IHttpService,
          _location: angular.ILocationService,
          _rootScope: angular.IScope,
          _route: angular.route.IRouteService,
          _sce: angular.ISCEService,
          _templateCache: angular.ITemplateCacheService) {
          if (_templateCache.get('html-templates/mainPage.html')) {
            log.error("Missing html-templates/mainPage.html in $templateCache");
          }
          $timeout = _timeout;
          $interval = _interval;
          $interpolate = _interpolate;
          $http = _http;
          $location = _location;
          $rootScope = _rootScope;
          $route = _route;
          $sce = _sce; // It's module-specific, or else I get: Error: [$sce:unsafe] Attempting to use an unsafe value in a safe context.

          log.alwaysLog("Angular loaded!");
          $rootScope['main'] = main;
        }]);
  }
}
