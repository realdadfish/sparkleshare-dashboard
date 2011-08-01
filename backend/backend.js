var GitBackend = require('./git').GitBackend;

Backend = function(config){
  this.id = null;
  this.type = config.type;
  this.name = config.name;
  this.path = config.path;

  this.backend = null;

  if (this.type == 'git') {
    this.backend = new GitBackend(this.path);
  }
};

Backend.prototype = {
  getRawData: function(req, ondata, next) {
    this.backend.getRawData(req, ondata, next);
  },

  getItems: function(req, next) {
    this.backend.getItems(req, next);
  },

  getId: function(next) {
    var b = this;
    if (!this.id) {
      this.backend.getId(function(error, id){
        b.id = id;
        next(null, id);
      });
    } else {
      next(null, this.id);
    }
  }
};

exports.Backend = Backend;
