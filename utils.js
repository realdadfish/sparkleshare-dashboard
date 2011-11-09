var config = require('./config');

module.exports = {
  aclFilterFolderList: function(folders, user) {
    if (!user.admin) {
      for (var fid in folders) {
        if (!(user.acl.indexOf(fid) >= 0)) {
          delete folders[fid];
        }
      }
    }

    return folders;
  },

  getLoggingFormat: function() {
    if (config.logging == 'min') {
      return 'short';
    } else if (config.logging == 'info') {
      return 'default';
    } else if (config.logging == 'debug') {
      return function (tokens, req, res) {
        var status = res.statusCode;
        var color = 32;

        if (status >= 500) {
          color = 31;
        } else if (status >= 400) {
          color = 33;
        } else if (status >= 300) {
          color = 36;
        }

        return "\033[90m" + req.method +
          " " + req.originalUrl + " " +
          "\033[" + color + "m" + res.statusCode +
          " \033[90m" +
          (new Date() - req._startTime) +
          "ms\033[0m" +
          " C: " + JSON.stringify(req.headers);
      };
    }

    return null;
  }
}
