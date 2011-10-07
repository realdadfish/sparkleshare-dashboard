GitBackend = function (path) {
  this.path = path;
};

var spawn = require('child_process').spawn;
var querystring = require('querystring');
var mime = require('mime');

function parseList(list, curPath, next) {
  var r = list.split(/\r\n|\r|\n/);
  linere = /^[0-9]+\s(blob|tree)\s([a-f0-9]{40})\s(.*)$/;

  ret = [];
  for(var i = 0; i < r.length; i++) {
    x = r[i].match(linere);
    if (x) {
      var type = null;
      var mimeType = null;
      if (x[1] == 'blob') {
        type = "file";
        mimeType = mime.lookup(x[3]);
      } else if (x[1] == 'tree') {
        type = "dir";
        mimeType = "dir";
      }

      ret.push({
        id: x[2],
        type: type,
        mime: mimeType,
        mimeBase: mimeType.split("/")[0],
        name: x[3],
        url: querystring.stringify({
          path: curPath.length ? curPath + '/' + x[3] : x[3],
          hash: x[2],
          name: x[3]
        }),
        directUrl: querystring.stringify({
          hash: x[2],
          name: x[3]
        })
      });
    }
  }
  next(null, ret);
}

GitBackend.prototype = {
  execGit: function(params, ondata, next) {
    if (typeof(next) == "undefined") {
      next = ondata;
      ondata = null;
    }

    var g = spawn('git', params, { encoding: 'binary', env: {
      GIT_DIR: this.path
    }});

    var out = null;
    if (ondata) {
      g.stdout.on('data', function(data) {
        ondata(null, data);
      });
    } else {
      out = "";
      g.stdout.on('data', function(data) {
        out += data.toString('utf8');
      });
    }

    g.on('exit', function(code) {
      if (code) {
        return next(new Error('GIT failed'));
      } else {
        return next(null, out);
      }
    });
  },

  getRawData: function(req, ondata, next) {
    var hash = req.param('hash');
    if (!hash) {
      return next(new Error('No hash'));
    }
    if (!hash.match(/^[a-f0-9]{40}$/)) {
      return next(new Error('Invalid hash'));
    }

    this.execGit(['cat-file', 'blob', hash], ondata, next);
  },

  getItems: function(req, next) {
    var baseHash = req.param('hash');
    var path = req.param('path');
    if (!path) {
      path = '';
    }

    var mybackend = this;
    function getItemsFromHere(baseHash, path, next) {
      var execPath = path;
      if (!baseHash) {
        baseHash = 'HEAD';
      }

      mybackend.execGit(['ls-tree', baseHash, ''], function(error, data) {
        if (error) { return next(error); }
        parseList(data, path, next);
      });
    }

    if (!baseHash && path) {
      this.execGit(['ls-tree', 'HEAD', path], function(error, data) {
        if (error) { return next(error); }
        parseList(data, path, function(error, list) {
          if (error) { return next(error); }
          if (list.length != 1) { return next(new Error('GIT parent lookup failed')); }
          baseHash = list[0].id;
          getItemsFromHere(baseHash, path, next);
        });
      });
    } else {
      getItemsFromHere(baseHash, path, next);
    }
  },

  getId: function(next) {
    this.execGit(['rev-list', '--reverse', 'HEAD'], function(error, data) {
        if (error) { return next(error); }
        var r = data.split(/\r\n|\r|\n/);
        if (r[0].match(/^[a-f0-9]{40}$/)) {
          next(null, r[0]);
        } else {
          next(new Error('Folder not initialized'));
        }
      }
    );
  }
};

exports.GitBackend = GitBackend;
