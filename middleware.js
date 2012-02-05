var userProvider = null;
var deviceProvider = null;
var folderProvider = null;
var linkCodeProvider = null;

var errors = require('./error');

module.exports = {
  setup: function(up, dp, fp, lcp) {
    userProvider = up;
    deviceProvider = dp;
    folderProvider = fp;
    linkCodeProvider = lcp;
  },

  isLogged: function(req, res, next) {
    if (req.session.user) {
      userProvider.findByUid(req.session.user.uid, function(error, user) {
        if (error || !user) {
          next(new errors.Permission('You must be logged in!'));
        } else {
          req.session.user = user;
          req.currentUser = user;
          next();
        }
      });
    } else {
      res.redirect('/login');
    }
  },

  isAdmin: function(req, res, next) {
    if (req.currentUser.admin) {
      next();
    } else {
      next(new errors.Permission('Only admin can do this!'));
    }
  },

  owningDevice: function(req, res, next) {
    if (req.currentUser.admin || req.loadedDevice.ownerUid == req.currentUser.uid) {
      next();
    } else {
      next(new errors.Permission('You are not admin nor you own this device!'));
    }
  },

  checkFolderAcl: function(req, res, next) {
    if (!req.params.folderId || req.currentUser.admin) {
      next();
    } else {
      if (req.currentUser.acl.indexOf(req.params.folderId) >= 0) {
        next();
      } else {
        next(new errors.Permission('You do not have a permission to access this folder'));
      }
    }
  },

  loadUser: function(req, res, next) {
    if (!req.params.uid) {
      next(new errors.NotFound('No user ID specified'));
    } else {
      userProvider.findByUid(req.params.uid, function(error, user) {
        if (error || !user) { return next(new errors.NotFound('User not found!')); }
        req.loadedUser = user;
        next();
      });
    }
  },

  loadDevice: function(req, res, next) {
    if (!req.params.did) {
      next(new errors.NotFound('No device ID specified'));
    } else {
      deviceProvider.findById(req.params.did, function(error, device) {
        if (error || !device) { return next(new errors.NotFound('Device not found')); }
        req.loadedDevice = device;
        next();
      });
    }
  },

  loadFolder: function(req, res, next) {
    if (!req.params.folderId) {
      next(new errors.NotFound('No folder specified'));
    } else {
      folderProvider.findById(req.params.folderId, function(error, folder) {
        if (error || !folder) { next(new errors.NotFound('Folder not found')); }
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
        req.linkCodeForUid = valid[1];
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
      deviceProvider.findByIdent(ident, function(error, device) {
        if (!device) {
          res.send('Invalid ident', 403);
        } else if (!device.ownerUid) {
          res.send('No device owner', 500);
        } else if (device.checkAuthCode(authCode)) {
          userProvider.findByUid(device.ownerUid, function(error, user) {
            if (error || !user) {
              res.send('Invalid owner', 403);
            } else {
              req.currentUser = user;
              req.currentDevice = device;
              next();
            }
          });
        } else {
          res.send('Invalid auth code', 403);
        }
      });
    }
  }
};
