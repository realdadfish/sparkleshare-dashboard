var Backend = require('./backend/backend').Backend;

FolderProvider = function(folders){
  var onGotId = function (error, id, forBackend) {
    if (!error && id) {
      f[id] = forBackend;
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
  next(null, this.folders);
};

FolderProvider.prototype.findById = function(id, next) {
  var result = null;

  if (id in this.folders) {
    result = this.folders[id];
  }

  if (!result) {
    next(new Error('No such folder'));
  } else {
    next(null, result);
  }
};

exports.FolderProvider = FolderProvider;
