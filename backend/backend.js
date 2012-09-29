var GitBackend = require('./git').GitBackend;

Backend = function(config){
  this.id = null;
  this.type = config.type;
  this.name = config.name;
  this.path = config.path;
  this.pub = config.pub;

  this.backend = null;

  if (this.type == 'git') {
    this.backend = new GitBackend(this.path);
  }
};

Backend.prototype = {
  getRawData: function(req, ondata, next) {
    this.backend.getRawData(req, ondata, next);
  },

  createArchive: function(req, ondata, next) {
    this.backend.createArchive(req, ondata, next);
  },

  getItems: function(req, next) {
    this.backend.getItems(req, next);
  },

  getRecentChanges: function(req, next) {
    this.backend.getRecentChanges(req, next);
  },

  getCurrentRevision: function(req, next) {
    this.backend.getCurrentRevision(req, next);
  },

  getAllItemCount: function(req, next) {
    this.backend.getAllItemCount(req, next);
  },

  getFolderItemCount: function(req, next) {
    this.backend.getFolderItemCount(req, next);
  },

  getId: function(next, forBackend) {
    var b = this;
    if (!this.id) {
      this.backend.getId(function(error, id){
        b.id = id;
        next(null, id, forBackend);
      });
    } else {
      next(null, this.id, forBackend);
    }
  }
};

exports.Backend = Backend;
