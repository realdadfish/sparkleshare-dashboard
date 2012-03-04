var config = require('../config');

GitBackend = function (path) {
  this.path = path;
};

var spawn = require('child_process').spawn;
var querystring = require('querystring');
var mime = require('mime');

function parseList(list, curPath, next) {
  var r = list.split(/\0/);
  linere = /^[0-9]+\s(blob|tree)\s([a-f0-9]{40})\s+([0-9]+|-)\t+(.*)$/;

  ret = [];
  for(var i = 0; i < r.length; i++) {
    x = r[i].match(linere);
    if (x) {
      var type = null;
      var mimeType = null;
      if (x[1] == 'blob') {
        type = "file";
        mimeType = mime.lookup(x[4]);
      } else if (x[1] == 'tree') {
        type = "dir";
        mimeType = "dir";
      }

      var listEntry = {
        id: x[2],
        hash: x[2],
        type: type,
        mime: mimeType,
        mimeBase: mimeType.split("/")[0],
        name: x[4],
        url: querystring.stringify({
          path: curPath.length ? curPath + '/' + x[4] : x[4],
          hash: x[2],
          name: x[4]
        }),
        directUrl: querystring.stringify({
          hash: x[2],
          name: x[4]
        })
      };

      if (type == 'file') {
        listEntry.fileSize = x[3];
      }

      ret.push(listEntry);
    }
  }
  next(null, ret);
}

function parseGitLog(data) {
  var lines =  data.split(/\r\n|\r|\n|\0/);
  var entries = [];
  var entryIndex = 0;
  var entry = "";
  var lastEntry = "";
  var j = 0;

  for(var i=0; i<lines.length; i++) {
    var line = lines[i];
    if ((line.slice(0,6) == "commit") && (j > 0)) {
      entries[entryIndex++] = entry;
      entry = "";
    }
    entry = entry + line + "\n";
    j++;
    lastEntry = entry;
  }
  entries[entryIndex++] = entry;

  var mergeRegex = /commit ([a-z0-9]{40})\nMerge: .+ .+\nAuthor: (.+) <(.+)>\nDate:   (.+)\n*/;
  var nonMergeRegex = /commit ([a-z0-9]{40})\nAuthor: (.+) <(.+)>\nDate:   (.+)\n*/;

  var changeSet = [];
  var changeSetIndex = 0;
  for(var i=0; i<entries.length; i++) {
    var logEntry = entries[i];
    var isMergeCommit = false;
    var regex;
    
    if (logEntry.indexOf("\nMerge: ") != -1) {
      regex = mergeRegex;
      isMergeCommit = true;
    } 
    else {
      regex = nonMergeRegex;
    }

    var result = logEntry.match(regex);
    if (result != null) {
      var changeSetEntry = new Object();

      changeSetEntry.revision = result[1];
      changeSetEntry.username = result[2];
      changeSetEntry.useremail = result[3];
      changeSetEntry.isMagical = isMergeCommit;
      var timestamp = new Date(result[4]);
      changeSetEntry.timestamp = timestamp;

      changeSetEntry.added = []; var ai = 0;
      changeSetEntry.edited = []; var ei = 0;
      changeSetEntry.deleted = []; var di = 0;
      changeSetEntry.renamed = []; var ri = 0;

      var entryLines = logEntry.split(/\r\n|\r|\n/);
      for(var elIndex = 0; elIndex < entryLines.length; elIndex++) {
        entryLine = entryLines[elIndex];
        if (entryLine.charAt(0) == ":") {
          var changeType = entryLine.charAt(37);
          var filePath = entryLines[elIndex + 1];
          var toFilePath = "";

          if (filePath.slice(-6) == ".empty") {
            filePath = filePath.substring(0, filePath.length - ".empty".length);
          }

          if ((changeType == "A") && (filePath.indexOf(".notes") == -1)) {
            changeSetEntry.added[ai++] = filePath;
          }
          else if (changeType == "M") {
            changeSetEntry.edited[ei++] = filePath;
          }
          else if (changeType == "D") {
            changeSetEntry.deleted[di++] = filePath;
          }
          else if (changeType == "R") {
            var renamedObj = new Object();
            var tabPos = entryLine.lastIndexOf("\t");
            filePath = entryLines[elIndex + 1];
            toFilePath = entryLines[elIndex + 2];
  
            renamedObj.from = filePath;
            renamedObj.to = toFilePath;

            changeSetEntry.renamed[ri++] = renamedObj;
          }
        }
      }
      
      if ((changeSetEntry.added.length 
           + changeSetEntry.edited.length 
           + changeSetEntry.deleted.length 
           + changeSetEntry.renamed.length) > 0) {
          changeSet[changeSetIndex++] = changeSetEntry;
      }
    }
  }

  return changeSet;
}

GitBackend.prototype = {
  execGit: function(params, ondata, next) {
    if (typeof(next) == "undefined") {
      next = ondata;
      ondata = null;
    }

    var g = spawn(config.backend.git.bin, params, { encoding: 'binary', env: {
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

      mybackend.execGit(['ls-tree', '-z', '-l', baseHash, ''], function(error, data) {
        if (error) { return next(error); }
        parseList(data, path, next);
      });
    }

    if (!baseHash && path) {
      this.execGit(['ls-tree', '-z', '-l', 'HEAD', path], function(error, data) {
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

  getRecentChanges: function(req, next) {
    this.execGit(['log', '-z', '-50', '--raw', '-M', '--date=iso'], function(error, data) {
      if (error) { return next(error); }

      var changes = parseGitLog(data)
      next(null, changes);
    });
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
  },

  getCurrentRevision: function(req, next) {
    this.execGit(['rev-list', '--max-count=1', 'HEAD'], function(error, data) {
      if (error) { return next(error); }
        var r = data.split(/\r\n|\r|\n/);
        if (r[0].match(/^[a-f0-9]{40}$/)) {
          next(null, r[0]);
        } else {
          next(new Error('Folder not initialized'));
        }
    });
  },

  getAllItemCount: function(req, next) {
    this.execGit(['ls-tree', '-rt', 'HEAD'], function(error, data) {
      if (error) { return next(error); }
        var r = data.split(/\r\n|\r|\n/);
        next(null, r.length - 1);
    });
  },

  getFolderItemCount: function(req, next) {
    this.getItems(req, function(error, items) {
      next(null, items.length);
    });
  }
};

exports.GitBackend = GitBackend;
