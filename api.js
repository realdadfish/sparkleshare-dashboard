var linkCodeProvider = null;
var deviceProvider = null;

function validateLinkCode(req, res, next) {
  var code = req.param('code');
  if (code && linkCodeProvider.isCodeValid(code)) {
    next();
  } else {
    res.send('Invalid link code', 403);
  }
}

Api = function(app, lcp, dp) {
  linkCodeProvider = lcp;
  deviceProvider = dp;

  app.get('/api/getAuthCode', validateLinkCode, function(req, res) {
    res.send('WWWX');
  });
};

module.exports = Api;
