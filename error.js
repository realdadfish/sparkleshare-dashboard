var util = require('util');

function NotFound(msg) {
  this.name = 'Not Found';
  this.message = msg;
  Error.call(this, msg); // really do not know why this is not working! Fixed by setting message manually
  Error.captureStackTrace(this, arguments.callee);
}
util.inherits(NotFound, Error);

function Permission(msg) {
  this.name = 'Forbidden';
  this.message = msg;
  Error.call(this, msg);
  Error.captureStackTrace(this, arguments.callee);
}
util.inherits(Permission, Error);

function ISE(msg) {
  this.name = 'Internal Server Error';
  this.message = msg;
  Error.call(this, msg);
  Error.captureStackTrace(this, arguments.callee);
}
util.inherits(ISE, Error);

function errorHandler(err, req, res, next) {
  if (err instanceof NotFound) {
    res.statusCode = 404;
  } else if (err instanceof Permission) {
    res.statusCode = 403;
  } else {
    res.statusCode = 500;
    return next();
  }

  var accept = req.headers.accept || '';
  if (~accept.indexOf('html')) {
    // html
    res.render('error', { e: err });
  } else if (~accept.indexOf('json')) {
    // json
    var json = JSON.stringify({ error: err.name, msg: err.message });
    res.setHeader('Content-Type', 'application/json');
    res.end(json);
  } else {
    // plain text
    res.setHeader('Content-Type', 'text/plain');
    res.end(err.name + ": " + err.message);
  }
}

module.exports = {
  NotFound: NotFound,
  Permission: Permission,
  errorHandler: errorHandler
};
