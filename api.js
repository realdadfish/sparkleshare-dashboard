var linkCodeProvider = null;
var deviceProvider = null;
var folderProvider = null;

function validateLinkCode(req, res, next) {
  var code = req.param('code');
  if (code && linkCodeProvider.isCodeValid(code)) {
    next();
  } else {
    res.send('Invalid link code', 403);
  }
}

function validateAuthCode(req, res, next) {
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

Api = function(app, lcp, dp, fp) {
  linkCodeProvider = lcp;
  deviceProvider = dp;
  folderProvider = fp;

  app.post('/api/getAuthCode', validateLinkCode, function(req, res) {
    deviceProvider.createNew(function(error, dev) {
      res.json({
        ident: dev.ident,
        authCode: dev.authCode
      });
    });
  });
  
  app.get('/api/getFolderList', validateAuthCode, function(req, res, next) {
    folderProvider.findAll(function(error, folders) {
      if (error) { return next(error); }
      var f = [];
      for (var id in folders) {
        if (folders.hasOwnProperty(id)) {
          f.push({
            name: folders[id].name,
            id: folders[id].id,
            type: folders[id].type
          });
        }
      }
      res.json(f);
    });
  });
};

module.exports = Api;
