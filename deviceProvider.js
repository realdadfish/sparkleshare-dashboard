var errors = require('./error');

DeviceProvider = function(redisClient) {
  this.rclient = redisClient;
};

DeviceProvider.prototype = {
  createNew: function(name, uid, next) {
    var provider = this;
    var newDevice = new Device();
    name = name ? name : '';

    provider.findUniqueNameForUid(uid, name, 0, function(error, reqName) {
      if (error) { return next(error); }

      newDevice.name = reqName;
      newDevice.ownerUid = uid;
      
      provider.rclient.incr('seq:nextDeviceId', function(error, nid) {
        if (error) { return next(error); }
        newDevice.id = nid;

        provider.rclient.set("deviceId:" + newDevice.id + ":device", JSON.stringify(newDevice));
        provider.rclient.set("deviceIdent:" + newDevice.ident + ":deviceId", newDevice.id);
        provider.rclient.sadd("deviceIds", newDevice.id);
        provider.rclient.sadd("uid:" + newDevice.ownerUid + ":devices", newDevice.id);
        provider.rclient.sadd("uid:" + newDevice.ownerUid + ":deviceNames", newDevice.name);

        next(null, newDevice);
      });
    });
  },

  findUniqueNameForUid: function(uid, name, num, next) {
    var provider = this;
    var reqName = name;
    if (num > 0) {
      reqName += " (" + num + ")";
    }

    provider.rclient.sismember("uid:" + uid + ":deviceNames", reqName, function(error, ismember) {
      if (error) { return next(error); }
      if (ismember) {
        provider.findUniqueNameForUid(uid, name, ++num, next);
      } else {
        next(null, reqName);
      }
    });
  },

  findAll: function(next) {
    var provider = this;
    provider.rclient.smembers("deviceIds", function(error, ids) {
      if (error) { return next(error); }
      var r = [];
      var count = ids.length;
      if (count === 0) {
        next (null, r);
      }
      ids.forEach(function(id) {
        provider.findById(id, function(error, device) {
          if (error) { return next(error); }
          r.push(device);
          if (--count === 0) {
            next(null, r);
          }
        });
      });
    });
  },

  findById: function(id, next) {
    this.rclient.get("deviceId:" + id + ":device", function(error, data) {
      if (error) { return next(error); }
      if (!data) { return next(); }

      next(null, new Device(JSON.parse(data)));
    });
  },

  findByIdent: function(ident, next) {
    var provider = this;
    this.rclient.get("deviceIdent:" + ident + ":deviceId", function(error, id) {
      if (error) { return next(error); }
      if (!id) { return next(); }

      provider.findById(id, next);
    });
  },

  findByUserId: function(uid, next) {
    var provider = this;

    this.rclient.smembers("uid:" + uid + ":devices", function(error, dids) {
      if (error) { return next(error); }

      var r = [];
      var count = dids.length;
      if (count === 0) {
        next (null, r);
      }
      dids.forEach(function(did) {
        provider.findById(did, function(error, device) {
          if (error) { return next(error); }
          r.push(device);
          if (--count === 0) {
            next(null, r);
          }
        });
      });
    });
  },

  updateDevice: function(device, next) {
    var provider = this;
    this.findById(device.id, function(error, fdevice) {
      if (error) { return next(error); }
      if (!fdevice) { return next(new errors.NotFound("Device not found")); }
      if (device.ident != fdevice.ident) {
        return next(new Error("You can not change ident!"));
      }
      if (device.ownerUid != fdevice.ownerUid) {
        return next(new Error("You can not change owner!"));
      }

      function saveDevice() {
        provider.rclient.set("deviceId:" + fdevice.id + ":device", JSON.stringify(device));

        return next(null, device);
      }

      if (device.name != fdevice.name) {
        if (fdevice.name && fdevice.name !== '') {
          provider.rclient.srem("uid:" + fdevice.ownerUid + ":deviceNames", fdevice.name);
        }

        provider.findUniqueNameForUid(device.ownerUid, device.name, 0, function(error, reqName) {
          if (error) { return next(error); }
          device.name = reqName;

          provider.rclient.sadd("uid:" + device.ownerUid + ":deviceNames", device.name);
          saveDevice();
        });
      } else {
        saveDevice();
      }
    });
  },

  unlinkDevice: function(id, next) {
    var provider = this;

    this.findById(id, function(error, fdevice) {
      if (error) { return next(error); }
      if (!fdevice) { return next(new errors.NotFound("Device not found")); }

      provider.rclient.del("deviceId:" + fdevice.id + ":device");
      provider.rclient.del("deviceIdent:" + fdevice.ident + ":deviceId");
      provider.rclient.srem("deviceIds", fdevice.id);
      provider.rclient.srem("uid:" + fdevice.ownerUid + ":devices", fdevice.id);
      if (fdevice.name && fdevice.name !== '') {
        provider.rclient.srem("uid:" + fdevice.ownerUid + ":deviceNames", fdevice.name);
      }

      next();
    });
  }
};

Device = function(data) {
  if (data) {
    this.id = data.id;
    this.ident = data.ident;
    this.authCode = data.authCode;
    this.name = data.name;
    this.ownerUid = data.ownerUid;
  } else {
    this.id = null;
    this.ident = this.genIdent();
    this.authCode = this.genAuthCode();
    this.name = "";
    this.ownerUid = null;
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
