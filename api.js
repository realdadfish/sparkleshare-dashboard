var deviceProvider = null;
var folderProvider = null;
var middleware = null;

Api = function(app, dp, fp, mw) {
  deviceProvider = dp;
  folderProvider = fp;
  middleware = mw;

  app.post('/api/getAuthCode', middleware.validateLinkCode, function(req, res) {
    deviceProvider.createNew(req.param('name'), req.linkCodeForLogin, function(error, dev) {
      res.json({
        ident: dev.ident,
        authCode: dev.authCode
      });
    });
  });
  
  app.get('/api/getFolderList', middleware.validateAuthCode, function(req, res, next) {
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

  app.get('/api/getFile/:folderId', middleware.validateAuthCode, middleware.loadFolder, function(req, res, next) {
    var filename = req.param('name');
    if (!filename) {
      filename = 'file';
    }
    res.attachment(filename);

    req.loadedFolder.getRawData(req,
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

  app.get('/api/getFolderContent/:folderId', middleware.validateAuthCode, middleware.loadFolder, function(req, res, next) {
    console.log(req.deviceAcl);
    req.loadedFolder.getItems(req, function(error, list) {
      if (error) { return next(error); }

      res.json(list);
    });
  });

  app.get('/api/getFolderRevision/:folderId', middleware.validateAuthCode, middleware.loadFolder, function(req, res, next) {
    req.loadedFolder.getCurrentRevision(req, function(error, revision) {
      if (error) { return next(error); }
      res.json(revision);
    });
  });

  app.get('/api/getAllItemCount/:folderId', middleware.validateAuthCode, middleware.loadFolder, function(req, res, next) {
    req.loadedFolder.getAllItemCount(req, function(error, count) {
      if (error) { return next(error); }
      res.json(count);
    });
  });

  app.get('/api/getFolderItemCount/:folderId', middleware.validateAuthCode, middleware.loadFolder, function(req, res, next) {
    req.loadedFolder.getFolderItemCount(req, function(error, count) {
      if (error) { return next(error); }
      res.json(count);
    });
  });
};

module.exports = Api;
