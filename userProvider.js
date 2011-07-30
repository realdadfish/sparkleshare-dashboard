var fs = require('fs');
var crypto = require('crypto');

function hash(msg, key) {
  return crypto.createHmac('sha256', key).update(msg).digest('hex');
}

UserProvider = function(filename, next) {
  if (filename) {
    this.filename = filename;
  } else {
    this.filename = null;
  }
  this.users = [];
  
  this.loadFromFile(next);
};

UserProvider.prototype = {
  loadFromFile: function(next) {
    if (!this.filename) { return next(new Error('No filename specified')); }

    var provider = this;

    fs.readFile(this.filename, 'utf8', function(error, data) {
      provider.users = [];

      if (!error) {
        var u = JSON.parse(data);

        for (var i = 0; i < u.length; i++) {
          var myuser = new User(u[i]);
          provider.users.push(myuser);
        }
      }

      if (next) {
        next();
      }
    });
  },

  saveToFile: function(next) {
    if (!this.filename) { return next(new Error('No filename specified')); }

    fs.writeFile(this.filename, JSON.stringify(this.users), 'utf8', function(error) {
      if (error) { return next(error); }
      return next(null);
    });
  },

  createNew: function(login, name, password, next) {
    var provider = this;
    this.findByLogin(login, function(error, user) {
      if (!user) {
        var newUser = new User();
        newUser.login = login;
        newUser.name = name;
        newUser.setPassword(password);
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
    if (!id) {
      return next(new Error('No such user'));
    }
    
    this.users[id] = user;
    this.saveToFile(function(error) {
      if (error) { return next(error); }
      return next(null, user);
    });
  },

  findAll: function(next) {
    next(null, this.users);
  },

  findByLogin: function(login, next) {
    var result = null;
    var resultId = null;

    for (var i = 0; i < this.users.length; i++) {
      if (this.users[i].login == login) {
        result = this.users[i];
        resultId = i;
        break;
      }
    }

    if (next) {
      next(null, result);
    }

    return resultId;
  },

  getUserCount: function(next) {
    next(null, this.users.length);
  }
};

User = function(data) {
  this.login = "";
  this.name = "";
  this.salt = "";
  this.pass = "";

  if (data) {
    this.login = data.login;
    this.name = data.name;
    this.salt = data.salt;
    this.pass = data.pass;
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
