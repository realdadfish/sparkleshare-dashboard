var config = require('./config');
var http = require('http');

http.createServer(function (request, response) {
  response.writeHead(200, {'Content-Type': 'text/plain'});
  response.end(request.method + " " + request.url);
}).listen(config.port, "127.0.0.1");

console.log('SparkleShare-Web is running at http://127.0.0.1:' + config.port);
