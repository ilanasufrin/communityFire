namespace gamingPlatform.chat {
  module.service('firebase', ['$window', ($window: ng.IWindowService) => {
    const {firebase} = $window;
    if (!firebase) {
      throw new Error('global firebase missing');
    }
    return firebase;
  }]);
}
