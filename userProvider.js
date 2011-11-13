var fs = require('fs');
var crypto = require('crypto');

function hash(msg, key) {
  return crypto.createHmac('sha256', key).update(msg).digest('hex');
}

UserProvider = function(redisClient) {
  this.rclient = redisClient;
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
        provider.users.push(newUser);
        provider.saveToFile(function(error) {
          if (error) { return next(error); }
          next(null, newUser);
        });
      } else {
        next(new Error('Login already used'));
      }
    });
  },

  updateUser: function(user, next) {
    var id = this.findByLogin(user.login);
    if (id === null) {
      return next(new Error('No such user'));
    }
    
    this.users[id] = user;
    this.saveToFile(function(error) {
      if (error) { return next(error); }
      return next(null, user);
    });
  },

  deleteUser: function(uid, next) {
    this.rclient.del("uid:" + uid + ":user");
    this.rclient.del("login:" + XXX + ":uid");
    this.rclient.srem("uids", uid);

    var id = this.findByLogin(login);

    if (id === null) {
      return next(new Error('No such user'));
    }
  },

  findByUid: function(uid, next) {
    this.rclient.get("uid:" + uid + ":user", function(error, data) {
      if (error) { return next(error); }
      next(null, JSON.parse(data));
    });
  },

  findByLogin: function(login, next) {
    var up = this;
    up.rclient.get("login:" + login + ":uid", function(error, uid) {
      if (error) { return next(error); }
      if (next) {
        up.findByUid(uid, next);
      }

      return uid;
    });
  },

  getUserCount: function(next) {
    this.rclient.scard("uids", next);
  }
};

User = function(data) {
  this.login = "";
  this.name = "";
  this.salt = "";
  this.pass = "";
  this.admin = false;
  this.acl = [];

  if (data) {
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

    for (var i=0; i < len; i++) {
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
