var gamingPlatform;
(function (gamingPlatform) {
    var chat;
    (function (chat) {
        chat.module.service('firebase', ['$window', function ($window) {
                var firebase = $window.firebase;
                if (!firebase) {
                    throw new Error('global firebase missing');
                }
                return firebase;
            }]);
    })(chat = gamingPlatform.chat || (gamingPlatform.chat = {}));
})(gamingPlatform || (gamingPlatform = {}));
//# sourceMappingURL=firebase.service.js.map