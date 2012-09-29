var error = require('./error');
var Backend = require('./backend/backend').Backend;

FolderProvider = function(folders){
  var onGotId = function (error, id, forBackend) {
    if (!error && id) {
      f[id] = forBackend;
    } else {
      console.log('could not add folder; no id returned: ' + error);
    }
  };

  for (var i = 0; i < folders.length; i++) {
    var backend = new Backend(folders[i]);
    var f = this.folders;
    backend.getId(onGotId, backend);
  }
};

FolderProvider.prototype.folders = {};

FolderProvider.prototype.findAll = function(next) {
  var f = {};
  for (var id in this.folders) {
    if (this.folders.hasOwnProperty(id)) {
      f[id] = this.folders[id];
    }
  }
  next(null, f);
};

FolderProvider.prototype.findById = function(id, next) {
  var result = null;

  if (id in this.folders) {
    result = this.folders[id];
  }

  if (!result) {
    next(new error.NotFound('No such folder'));
  } else {
    next(null, result);
  }
};

exports.FolderProvider = FolderProvider;
