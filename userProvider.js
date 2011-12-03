var crypto = require('crypto');
var errors = require('./error');

function hash(msg, key) {
  return crypto.createHmac('sha256', key).update(msg).digest('hex');
}

UserProvider = function(redisClient, deviceProvider) {
  this.rclient = redisClient;
  this.deviceProvider = deviceProvider;
};

UserProvider.prototype = {
  createNew: function(login, name, password, admin, acl, next) {
    var provider = this;
    this.findByLogin(login, function(error, user) {
      if (!user) {
        var newUser = new User();
        newUser.login = login;
        newUser.name = name;
        newUser.setPassword(password);
        newUser.admin = admin;
        newUser.acl = acl;
        provider.rclient.incr('seq:nextUserId', function(error, nuid) {
          if (error) { return next(error); }
          newUser.uid = nuid;

          provider.rclient.set("uid:" + newUser.uid + ":user", JSON.stringify(newUser));
          provider.rclient.sadd("uid:" + newUser.uid + ":deviceNames", '');
          provider.rclient.set("login:" + newUser.login + ":uid", newUser.uid);
          provider.rclient.sadd("uids", newUser.uid);

          next(null, newUser);
        });
      } else {
        next(new Error('Login already used'));
      }
    });
  },

  updateUser: function(user, next) {
    var provider = this;

    this.findByUid(user.uid, function(error, fuser) {
      if (error) { return next(error); }
      if (!fuser) { return next(new errors.NotFound("User not found")); }
      if (user.login != fuser.login) {
        return next(new Error("You can not change login!"));
      }

      provider.rclient.set("uid:" + fuser.uid + ":user", JSON.stringify(user));

      return next(null, user);
    });
  },

  deleteUser: function(uid, next) {
    var provider = this;

    this.findByUid(uid, function(error, fuser) {
      if (error) { return next(error); }
      if (!fuser) { return next(new errors.NotFound("User not found")); }

      var delUser = function() {
        provider.rclient.del("uid:" + fuser.uid + ":user");
        provider.rclient.del("uid:" + fuser.uid + ":devices");
        provider.rclient.del("uid:" + fuser.uid + ":deviceNames");
        provider.rclient.del("login:" + fuser.login + ":uid");
        provider.rclient.srem("uids", fuser.uid);
      };

      // unlink all devices owned by user
      provider.deviceProvider.findByUserId(fuser.uid, function(error, devices) {
        if (error) { return next(error); }

        var count = devices.length;
        if (count === 0) {
          delUser();
        }
        devices.forEach(function(device) {
          provider.deviceProvider.unlinkDevice(device.id, function(error) {
            if (error) { return next(error); }
            if (--count === 0) {
              delUser();
            }
          });
        });
      });

      next();
    });
  },

  findByUid: function(uid, next) {
    this.rclient.get("uid:" + uid + ":user", function(error, data) {
      if (error) { return next(error); }
      if (!data) { return next(); }
      next(null, new User(JSON.parse(data)));
    });
  },

  findByLogin: function(login, next) {
    var provider = this;
    provider.rclient.get("login:" + login + ":uid", function(error, uid) {
      if (error) { return next(error); }
      if (!uid) { next(); return null; }
      if (next) {
        provider.findByUid(uid, next);
      }

      return uid;
    });
  },

  getUserCount: function(next) {
    this.rclient.scard("uids", next);
  },

  findAll: function(next) {
    var provider = this;
    provider.rclient.smembers("uids", function(error, uids)  {
      if (error) { return next(error); }
      var r = [];
      var count = uids.length;
      if (count === 0) {
        next (null, r);
      }
      uids.forEach(function(uid) {
        provider.findByUid(uid, function(error, user) {
          if (error) { return next(error); }
          r.push(user);
          if (--count === 0) {
            next(null, r);
          }
        });
      });
    });
  }
};

User = function(data) {
  this.uid = null;
  this.login = "";
  this.name = "";
  this.salt = "";
  this.pass = "";
  this.admin = false;
  this.acl = [];

  if (data) {
    this.uid = data.uid;
    this.login = data.login;
    this.name = data.name;
    this.salt = data.salt;
    this.pass = data.pass;
    this.admin = data.admin ? true : false;
    this.acl = data.acl ? data.acl : [];
  }
};

User.prototype = {
  genSalt: function(len) {
    var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    var salt = '';

    for (var i = 0; i < len; i++) {
      salt += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return salt;
  },

  setPassword: function(password) {
    var salt = this.genSalt(8);
    this.pass = hash(password, salt);
    this.salt = salt;
  },

  checkPassword: function(password) {
    return this.pass == hash(password, this.salt);
  }
};

exports.UserProvider = UserProvider;
