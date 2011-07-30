/**
 * Module dependencies.
 */
var express = require('express');
var querystring = require('querystring');

var config = require('./config');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
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

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.flash('error', 'Access denied!');
    res.redirect('/login');
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
      res.render('login');
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

  userProvider.createNew(req.body.login, req.body.realname, req.body.passwd1, function(error, user) {
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

app.get('/folder/:folderId?', restrict, function(req, res, next){
  if (!req.params.folderId) {
    folderProvider.findAll(function(error, folders){
      if (error) {return next(error);}
      res.render('folders', {
        folders: folders
      });
    });
  } else {
    folderProvider.findById(req.params.folderId, function(error, folder){
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
    });
  }
});

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
