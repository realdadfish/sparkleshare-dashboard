var userProvider = null;
var deviceProvider = null;
var folderProvider = null;
var linkCodeProvider = null;

module.exports = {
  setup: function(up, dp, fp, lcp) {
    userProvider = up;
    deviceProvider = dp;
    folderProvider = fp;
    linkCodeProvider = lcp;
  },

  isLogged: function(req, res, next) {
    if (req.session.user) {
      userProvider.findByLogin(req.session.user.login, function(error, user) {
        if (error || !user) {
          req.flash('error', 'Access denied!');
          res.redirect('/login');
        } else {
          req.session.user = user;
          next();
        }
      });
    } else {
      req.flash('error', 'Access denied!');
      res.redirect('/login');
    }
  },

  isAdmin: function(req, res, next) {
    if (req.session.user.admin) {
      next();
    } else {
      req.flash('error', 'Only admin can do this');
      res.redirect('home');
    }
  },

  checkFolderAcl: function(req, res, next) {
    if (!req.params.folderId || req.session.user.admin) {
      next();
    } else {
      if (req.session.user.acl.indexOf(req.params.folderId) >= 0) {
        next();
      } else {
        req.flash('error', 'You do not have a permission to access this folder');
        res.redirect('home');
      }
    }
  },

  loadUser: function(req, res, next) {
    if (!req.params.login) {
      throw new Error('No login specified');
    } else {
      userProvider.findByLogin(req.params.login, function(error, user) {
        if (error || !user) { throw new Error('User not found'); }
        req.loadedUser = user;
        next();
      });
    }
  },

  loadDevice: function(req, res, next) {
    if (!req.params.ident) {
      throw new Error('No device ident specified');
    } else {
      deviceProvider.findByDeviceIdent(req.params.ident, function(error, device) {
        if (error || !device) { throw new Error('Device not found'); }
        req.loadedDevice = device;
        next();
      });
    }
  },

  loadFolder: function(req, res, next) {
    if (!req.params.folderId) {
      throw new Error('No folder specified');
    } else {
      folderProvider.findById(req.params.folderId, function(error, folder) {
        if (error || !folder) { throw new Error('Folder not found'); }
        req.loadedFolder = folder;
        next();
      });
    }
  },

  userDbEmpty: function(req, res, next) {
    userProvider.getUserCount(function(error, count) {
      if (count < 1) {
        next();
      } else {
        req.flash('error', 'There are already some users. Ask admin for an account');
        res.redirect('/login');
      }
    });
  },

  validateLinkCode: function(req, res, next) {
    var code = req.param('code');
    if (code) {
      var valid = linkCodeProvider.isCodeValid(code);
      if (valid[0]) {
        req.linkCodeForLogin = valid[1];
        next();
      } else {
        res.send('Invalid link code', 403);
      }
    } else {
      res.send('Invalid link code', 403);
    }
  },

  validateAuthCode: function(req, res, next) {
    var ident = req.header('X-SPARKLE-IDENT');
    var authCode = req.header('X-SPARKLE-AUTH');
    if (!ident || !authCode) {
      res.send('Missing auth code', 403);
    } else {
      deviceProvider.findByDeviceIdent(ident, function(error, device) {
        if (!device) {
          res.send('Invalid ident', 403);
        } else if (device.checkAuthCode(authCode)) {
          next();
        } else {
          res.send('Invalid auth code', 403);
        }
      });
    }
  }
}
