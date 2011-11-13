/**
 * Module dependencies.
 */
var express = require('express');
var querystring = require('querystring');

var config = require('./config');
var errors = require('./error');
var utils = require('./utils');

var RedisStore = require('connect-redis')(express);
var redis = require('redis'), redisClient = redis.createClient();

var app = null;
if (config.https.enabled) {
  var fs = require("fs");
  var privateKey = fs.readFileSync(config.https.key);
  var certificate = fs.readFileSync(config.https.cert);
  app = module.exports = express.createServer({ key: privateKey, cert: certificate });
} else {
  app = module.exports = express.createServer();
}

// Configuration
app.configure(function(){
  var lf = utils.getLoggingFormat();
  if (lf) {
    app.use(express.logger(lf));
  }
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('basepath', config.basepath);
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: config.sessionSecret, store: new RedisStore() }));
  app.use(express.compiler({ src: __dirname + '/public', enable: ['sass'] }));
  app.use(express.static(__dirname + '/public'));
  app.use(app.router);
});

var FolderProvider = require('./folderProvider').FolderProvider;
var folderProvider = new FolderProvider(config.folders);
var UserProvider = require('./userProvider').UserProvider;
var userProvider = new UserProvider(redisClient);
var LinkCodeProvider = require('./linkCodeProvider').LinkCodeProvider;
var linkCodeProvider = new LinkCodeProvider();
var DeviceProvider = require('./deviceProvider').DeviceProvider;
var deviceProvider = new DeviceProvider('./device.db.json');

var middleware = require('./middleware');
middleware.setup(userProvider, deviceProvider, folderProvider, linkCodeProvider);

require('./api')(app, deviceProvider, folderProvider, middleware);

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(errors.errorHandler);
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

app.get('/createFirstUser', middleware.userDbEmpty, function(req, res) {
  res.render('createFirstUser', { formval: {} });
});

app.post('/createFirstUser', middleware.userDbEmpty, function(req, res) {
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

  userProvider.createNew(req.body.login, req.body.realname, req.body.passwd1, true, [], function(error, user) {
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

app.get('/changeProfile', middleware.isLogged, function(req, res) {
  res.render('changeProfile', {
    formval: req.session.user
  });
});

app.post('/changeProfile', middleware.isLogged, function(req, res, next) {
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

app.get('/manageUsers', [middleware.isLogged, middleware.isAdmin], function(req, res, next) {
  userProvider.findAll(function(error, u) {
    if (error) { return next(error); }
    res.render('manageUsers', {
      users: u
    });
  });
});

app.get('/modifyUser/:login', [middleware.isLogged, middleware.isAdmin, middleware.loadUser], function(req, res, next) {
  folderProvider.findAll(function(error, folders) {
    if (error) { return next(error); }
    res.render('modifyUser', {
      u: req.loadedUser,
      folders: folders
    });
  });
});

app.post('/modifyUser/:login', [middleware.isLogged, middleware.isAdmin, middleware.loadUser], function(req, res, next) {
  folderProvider.findAll(function(error, folders) {
    if (error) { return next(error); }

    var u = req.loadedUser;
    u.name = req.body.name;
    u.admin = req.body.admin == 't' ? true : false;
    u.acl = req.body.acl ? req.body.acl : [];

    userProvider.updateUser(u, function(error) {
      req.flash('info', 'User updated');
      res.redirect('back');
    });
  });
});

app.get('/deleteUser/:login', [middleware.isLogged, middleware.isAdmin, middleware.loadUser], function(req, res, next) {
  res.render('deleteUser', {
    u: req.loadedUser
  });
});

app.post('/deleteUser/:login', [middleware.isLogged, middleware.isAdmin, middleware.loadUser], function(req, res, next) {
  var reRenderForm = function() {
    res.render('deleteUser', {
      u: req.body
    });
  };

  var u = req.loadedUser;

  userProvider.deleteUser(u.login, function(error) {
    req.flash('info', 'User deleted');
    res.redirect('/manageUsers');
  });
});

app.get('/createUser', [middleware.isLogged, middleware.isAdmin], function(req, res) {
  res.render('createUser', { formval: {} });
});

app.post('/createUser', [middleware.isLogged, middleware.isAdmin], function(req, res) {
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

  userProvider.createNew(req.body.login, req.body.realname, req.body.passwd1, req.body.admin == 't', [], function(error, user) {
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
      next(new errors.Permission('This is not a public folder'));
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

app.get('/folder/:folderId?', middleware.isLogged, middleware.checkFolderAcl, function(req, res, next) {
  if (!req.params.folderId) {
    folderProvider.findAll(function(error, folders){
      if (error) { return next(error); }

      utils.aclFilterFolderList(folders, req.session.user);

      res.render('folders', {
        folders: folders
      });
    });
  } else {
    folderProvider.findById(req.params.folderId, function(error, folder) {
      if (error) { return next(error); }

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

app.get('/linkedDevices', middleware.isLogged, function(req, res, next) {
  deviceProvider.findByUser(req.session.user, function(error, devices) {
    if (error) { return next(error); }
    res.render('linkedDevices', {
      devices: devices
    });
  });
});

app.get('/linkDevice', middleware.isLogged, function(req, res) {
  var schema = config.https.enabled ? 'https' : 'http';
  var url = schema + '://' + req.header('host');

  if (config.externalUrl) {
    url = config.externalUrl;
  }

  res.render('linkDevice', {
    url: url
  });
});


app.get('/unlinkDevice/:ident', [middleware.isLogged, middleware.loadDevice, middleware.owningDevice], function(req, res, next) {
  res.render('unlinkDevice', {
    d: req.loadedDevice
  });
});

app.post('/unlinkDevice/:ident', [middleware.isLogged, middleware.loadDevice, middleware.owningDevice], function(req, res, next) {
  var d = req.loadedDevice;

  deviceProvider.unlinkDevice(d.ident, function(error) {
    req.flash('info', 'Device unlinked');
    res.redirect('/linkedDevices');
  });
});

app.get('/modifyDevice/:ident', [middleware.isLogged, middleware.loadDevice, middleware.owningDevice], function(req, res, next) {
  res.render('modifyDevice', {
    d: req.loadedDevice
  });
});

app.post('/modifyDevice/:ident', [middleware.isLogged, middleware.loadDevice, middleware.owningDevice], function(req, res, next) {
  var d = req.loadedDevice;
  d.name = req.body.name;

  deviceProvider.updateDevice(d, function(error) {
    req.flash('info', 'Device updated');
    res.redirect('back');
  });
});

app.get('/getLinkCode', middleware.isLogged, function(req, res) {
  var code = linkCodeProvider.getNewCode(req.session.user.login);
  var schema = config.https.enabled ? 'https' : 'http';
  code.url = schema + '://' + req.header('host');

  if (config.externalUrl) {
    code.url = config.externalUrl;
  }

  res.contentType('application/json');
  res.send(code);
});

// always keep this as last route
app.get('/stylesheets', function(req, res, next) {
  next();
});

app.get('*', function(req, res, next){
  next(new errors.NotFound(req.url));
});


app.listen(config.listen.port, config.listen.host);
console.log("SparkleShare Dashboard listening on port %d in %s mode", app.address().port, app.settings.env);
