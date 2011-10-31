/**
 * Module dependencies.
 */
var express = require('express');
var querystring = require('querystring');

var config = require('./config');

var app = null;
if (config.https.enabled) {
  var fs = require("fs");
  var privateKey = fs.readFileSync(config.https.key);
  var certificate = fs.readFileSync(config.https.cert);
  app = module.exports = express.createServer({ key: privateKey, cert: certificate });
} else {
  app = module.exports = express.createServer();
}


function getLoggingFormat() {
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

// Configuration
app.configure(function(){
  var lf = getLoggingFormat();
  if (lf) {
    app.use(express.logger(lf));
  }
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('basepath', config.basepath);
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'your secret here' }));
  app.use(express.compiler({ src: __dirname + '/public', enable: ['sass'] }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

var FolderProvider = require('./folderProvider').FolderProvider;
var folderProvider = new FolderProvider(config.folders);
var UserProvider = require('./userProvider').UserProvider;
var userProvider = new UserProvider('./user.db.json');
var LinkCodeProvider = require('./linkCodeProvider').LinkCodeProvider;
var linkCodeProvider = new LinkCodeProvider();
var DeviceProvider = require('./deviceProvider').DeviceProvider;
var deviceProvider = new DeviceProvider('./device.db.json');

require('./api')(app, linkCodeProvider, deviceProvider, folderProvider);

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

function auth(login, pass, next) {
 userProvider.findByLogin(login, function(error, user) {
    if (!user) {
      return next(new Error('Invalid login'));
    }

    if (user.checkPassword(pass)) {
      return next(null, user);
    } else {
      return next(new Error('Invalid login'));
    }
  });
}

function isLogged(req, res, next) {
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
}

function isAdmin(req, res, next) {
  if (req.session.user.admin) {
    next();
  } else {
    req.flash('error', 'Only admin can do this');
    res.redirect('home');
  }
}

function loadUser(req, res, next) {
  if (!req.params.login) {
    throw new Error('No login specified');
  } else {
    userProvider.findByLogin(req.params.login, function(error, user) {
      if (error || !user) { throw new Error('User not found'); }
      req.loadedUser = user;
      next();
    });
  }
}

function loadDevice(req, res, next) {
  if (!req.params.ident) {
    throw new Error('No device ident specified');
  } else {
    deviceProvider.findByDeviceIdent(req.params.ident, function(error, device) {
      if (error || !device) { throw new Error('Device not found'); }
      req.loadedDevice = device;
      next();
    });
  }
}

function userDbEmpty(req, res, next) {
  userProvider.getUserCount(function(error, count) {
    if (count < 1) {
      next();
    } else {
      req.flash('error', 'There are already some users. Ask admin for an account');
      res.redirect('/login');
    }
  });
}

// Dynamic helpers
app.dynamicHelpers({
  messages: require('express-messages'),
  user: function(req, res) {
    return req.session.user;
  },
  basepath: function() {
    return this.set('basepath');
  }
});

app.helpers({
  convertSize: function(bytes) {
    var unit = 0;
    while (unit < 3 && bytes >= 1024) {
      unit++;
      bytes /= 1024;
    }

    return (Math.round(bytes * 100, 2) / 100).toString() + " " + ["", "Ki", "Mi", "Gi"][unit] + "B";
  }
});

// Routes
app.get('/', function(req, res){
  res.redirect('/login');
});

app.get('/logout', function(req, res){
  req.session.destroy(function(){
    res.redirect('home');
  });
});

app.get('/login', function(req, res){
  userProvider.getUserCount(function(error, count) {
    if (count < 1) {
      res.redirect('/createFirstUser');
    } else {
      if (req.session.user) {
        res.redirect('/folder');
      } else {
        res.render('login');
      }
    }
  });
});

app.get('/createFirstUser', userDbEmpty, function(req, res) {
  res.render('createFirstUser', { formval: {} });
});

app.post('/createFirstUser', userDbEmpty, function(req, res) {
  var reRenderForm = function() {
    res.render('createFirstUser', {
      formval: req.body
    });
  };

  if (!req.body.passwd1) {
    req.flash('error', 'Password could not be empty');
    return reRenderForm();
  }

  if (req.body.passwd1 != req.body.passwd2) {
    req.flash('error', 'Passwords must match');
    return reRenderForm();
  }

  userProvider.createNew(req.body.login, req.body.realname, req.body.passwd1, true, function(error, user) {
    if (error) {
      req.flash('error', error);
      reRenderForm();
    } else {
      res.redirect('/login');
    }
  });
});

app.post('/login', function(req, res){
  auth(req.body.login, req.body.password, function(error, user) {
    if (error) {
      req.flash('error', error);
      res.render('login');
    } else {
      if (user) {
        req.session.regenerate(function(){
          req.session.user = user;
          res.redirect('back');
        });
      } else {
        req.flash('error', error);
        res.render('login');
      }
    }
  });
});

app.get('/changeProfile', isLogged, function(req, res) {
  res.render('changeProfile', {
    formval: req.session.user
  });
});

app.post('/changeProfile', isLogged, function(req, res, next) {
  var reRenderForm = function() {
    res.render('changeProfile', {
      formval: req.body
    });
  };

  var updatePassword = false;
  if (req.body.new1) {
    if (req.body.new1 != req.body.new2) {
      req.flash('error', 'Passwords must match');
      return reRenderForm();
    }

    updatePassword = true;
  }

  var user = req.session.user;
  if (updatePassword) {
    user.setPassword(req.body.new1);
    req.flash('info', 'Password updated');
  }
  user.name = req.body.name;

  userProvider.updateUser(user, function(error) {
    req.flash('info', 'Profile updated');
    res.redirect('back');
  });
});

app.get('/manageUsers', [isLogged, isAdmin], function(req, res, next) {
  userProvider.findAll(function(error, u) {
    if (error) { return next(error); }
    res.render('manageUsers', {
      users: u
    });
  });
});

app.get('/modifyUser/:login', [isLogged, isAdmin, loadUser], function(req, res, next) {
  res.render('modifyUser', {
    u: req.loadedUser
  });
});

app.post('/modifyUser/:login', [isLogged, isAdmin, loadUser], function(req, res, next) {
  var reRenderForm = function() {
    res.render('modifyUser', {
      u: req.body
    });
  };

  var u = req.loadedUser;
  u.name = req.body.name;
  u.admin = req.body.admin == 't' ? true : false;

  userProvider.updateUser(u, function(error) {
    req.flash('info', 'User updated');
    res.redirect('back');
  });
});

app.get('/deleteUser/:login', [isLogged, isAdmin, loadUser], function(req, res, next) {
  res.render('deleteUser', {
    u: req.loadedUser
  });
});

app.post('/deleteUser/:login', [isLogged, isAdmin, loadUser], function(req, res, next) {
  var u = req.loadedUser;

  userProvider.deleteUser(u.login, function(error) {
    req.flash('info', 'User deleted');
    res.redirect('/manageUsers');
  });
});

app.get('/createUser', [isLogged, isAdmin], function(req, res) {
  res.render('createUser', { formval: {} });
});

app.post('/createUser', [isLogged, isAdmin], function(req, res) {
  var reRenderForm = function() {
    res.render('createUser', {
      formval: req.body
    });
  };

  if (!req.body.passwd1) {
    req.flash('error', 'Password could not be empty');
    return reRenderForm();
  }

  if (req.body.passwd1 != req.body.passwd2) {
    req.flash('error', 'Passwords must match');
    return reRenderForm();
  }

  userProvider.createNew(req.body.login, req.body.realname, req.body.passwd1, req.body.admin == 't', function(error, user) {
    if (error) {
      req.flash('error', error);
      reRenderForm();
    } else {
      req.flash('info', 'User created');
      res.redirect('/manageUsers');
    }
  });
});

app.get('/publicFolder/:folderId', function(req, res, next) {
  folderProvider.findById(req.params.folderId, function(error, folder) {
    if (!folder.pub) {
      res.render('error', {
        status: 403,
        message: 'Bad public link'
      });
    } else {
      var filename = req.param('name');
      if (!filename) {
        filename = 'file';
      }
      res.attachment(filename);

      folder.getRawData(req,
        function(error, data) {
          if (error) { return next(error); }
          res.write(data);
        },
        function(error, data) {
          if (error) { return next(error); }
          res.end();
        }
      );
    }
  });
});

app.get('/folder/:folderId?', isLogged, function(req, res, next) {
  if (!req.params.folderId) {
    folderProvider.findAll(function(error, folders){
      if (error) {return next(error);}
      res.render('folders', {
        folders: folders
      });
    });
  } else {
    folderProvider.findById(req.params.folderId, function(error, folder) {
      if (req.param('type') == 'file') {
        var filename = req.param('name');
        if (!filename) {
          filename = 'file';
        }
        res.attachment(filename);

        folder.getRawData(req,
          function(error, data) {
            if (error) { return next(error); }
            res.write(data);
          },
          function(error, data) {
            if (error) { return next(error); }
            res.end();
          }
        );
      } else {
        folder.getItems(req, function(error, list) {
          if (error) { return next(error); }

          var curPath = req.param('path');
          var parUrl = null;

          if (curPath) {
            var parPath = curPath.split('/');
            parPath.pop();
            parPath = parPath.join('/');
            parUrl = querystring.stringify({
              path: parPath
            });
          }

          res.render('folder', {
            folder: folder,
            tree: list,
            path: curPath,
            parUrl: parUrl
          });
        });
      }
    });
  }
});

app.get('/linkedDevices', [isLogged, isAdmin], function(req, res, next) {
  deviceProvider.findAll(function(error, devices) {
    if (error) { return next(error); }
    res.render('linkedDevices', {
      devices: devices
    });
  });
});

app.get('/linkDevice', [isLogged, isAdmin], function(req, res) {
  var code = linkCodeProvider.getNewCode();
  var schema = config.https.enabled ? 'https' : 'http';
  var url = schema + '://' + req.header('host');

  res.render('linkDevice', {
    url: url
  });
});


app.get('/unlinkDevice/:ident', [isLogged, isAdmin, loadDevice], function(req, res, next) {
  res.render('unlinkDevice', {
    d: req.loadedDevice
  });
});

app.post('/unlinkDevice/:ident', [isLogged, isAdmin, loadDevice], function(req, res, next) {
  var d = req.loadedDevice;

  deviceProvider.unlinkDevice(d.ident, function(error) {
    req.flash('info', 'Device unlinked');
    res.redirect('/linkedDevices');
  });
});

app.get('/modifyDevice/:ident', [isLogged, isAdmin, loadDevice], function(req, res, next) {
  res.render('modifyDevice', {
    d: req.loadedDevice
  });
});

app.post('/modifyDevice/:ident', [isLogged, isAdmin, loadDevice], function(req, res, next) {
  var d = req.loadedDevice;
  d.name = req.body.name;

  deviceProvider.updateDevice(d, function(error) {
    req.flash('info', 'Device updated');
    res.redirect('back');
  });
});

app.get('/getLinkCode', [isLogged, isAdmin], function(req, res) {
  var code = linkCodeProvider.getNewCode();
  var schema = config.https.enabled ? 'https' : 'http';
  code.url = schema + '://' + req.header('host');

  res.contentType('application/json');
  res.send(code);
});

app.listen(config.listen.port, config.listen.host);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
