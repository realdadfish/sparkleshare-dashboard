var fs = require('fs');

DeviceProvider = function(filename, next) {
  if (filename) {
    this.filename = filename;
  } else {
    this.filename = null;
  }
  this.devices = [];
  
  this.loadFromFile(next);
};

DeviceProvider.prototype = {
  loadFromFile: function(next) {
    if (!this.filename) { return next(new Error('No filename specified')); }

    var provider = this;

    fs.readFile(this.filename, 'utf8', function(error, data) {
      provider.devices = [];

      if (!error) {
        var u = JSON.parse(data);

        for (var i = 0; i < u.length; i++) {
          var mydevice = new Device(u[i]);
          provider.devices.push(mydevice);
        }
      }

      if (next) {
        next();
      }
    });
  },

  saveToFile: function(next) {
    if (!this.filename) { return next(new Error('No filename specified')); }

    fs.writeFile(this.filename, JSON.stringify(this.devices), 'utf8', function(error) {
      if (error) { return next(error); }
      return next(null);
    });
  },

  createNew: function(login, name, password, next) {
    var provider = this;
    this.findByLogin(login, function(error, device) {
      if (!device) {
        var newDevice = new Device();
        newDevice.login = login;
        newDevice.name = name;
        newDevice.setPassword(password);
        provider.devices.push(newDevice);
        provider.saveToFile(function(error) {
          if (error) { return next(error); }
          next(null, newDevice);
        });
      } else {
        next(new Error('Login already used'));
      }
    });
  },

  findAll: function(next) {
    next(null, this.devices);
  },

  findByDeviceIdent: function(login, next) {
    var result = null;
    var resultId = null;

    for (var i = 0; i < this.devices.length; i++) {
      if (this.devices[i].ident == ident) {
        result = this.devices[i];
        resultId = i;
        break;
      }
    }

    if (next) {
      next(null, result);
    }

    return resultId;
  }
};

Device = function(data) {
  this.ident = "";
  this.authCode = "";
  this.name = "";

  if (data) {
    this.ident = data.ident;
    this.authCode = data.authCode;
    this.name = data.name;
  }
};

Device.prototype = {
  genCode: function(len) {
    var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-_";
    var salt = '';

    for (var i=0; i < len; i++) {
      salt += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return salt;
  },

  genIdent: function() {
    return this.genCode(8);
  },

  genAuthCode: function() {
    return this.genCode(200);
  },

  checkAuthCode: function(authCode) {
    return this.authCode == authCode;
  }
};

exports.DeviceProvider = DeviceProvider;
