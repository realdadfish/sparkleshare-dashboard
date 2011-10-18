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
    deviceProvider.createNew(req.param('name'), function(error, dev) {
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

  app.get('/api/getFile/:folderId', validateAuthCode, function(req, res, next) {
    folderProvider.findById(req.params.folderId, function(error, folder) {
      if (error) { return next(error); }

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
    });
  });

  app.get('/api/getFolderContent/:folderId', validateAuthCode, function(req, res, next) {
    folderProvider.findById(req.params.folderId, function(error, folder) {
      folder.getItems(req, function(error, list) {
        if (error) { return next(error); }

        res.json(list);
      });
    });
  });

  app.get('/api/getFolderRevision/:folderId', validateAuthCode, function(req, res, next) {
    folderProvider.findById(req.params.folderId, function(error, folder) {
      folder.getCurrentRevision(req, function(error, revision) {
        if (error) { return next(error); }
        res.json(revision);
      });
    });
  });

  app.get('/api/getAllItemCount/:folderId', validateAuthCode, function(req, res, next) {
    folderProvider.findById(req.params.folderId, function(error, folder) {
      folder.getAllItemCount(req, function(error, count) {
        if (error) { return next(error); }
        res.json(count);
      });
    });
  });

  app.get('/api/getFolderItemCount/:folderId', validateAuthCode, function(req, res, next) {
    folderProvider.findById(req.params.folderId, function(error, folder) {
      folder.getFolderItemCount(req, function(error, count) {
        if (error) { return next(error); }
        res.json(count);
      });
    });
  });
};

module.exports = Api;
