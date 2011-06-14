//
//   SparkleShare-Web - An HTTP API to your SparkleShare server.
//   Copyright (C) 2011 The SparkleShare Community  <http://www.sparkleshare.org>
//
//   This program is free software: you can redistribute it and/or modify
//   it under the terms of the GNU Affero General Public License as
//   published by the Free Software Foundation, either version 3 of the
//   License, or (at your option) any later version.
//
   
var config = require('./config');
var http = require('http');

http.createServer(function (request, response) {
  response.writeHead(200, {'Content-Type': 'text/plain'});
  response.end(request.method + " " + request.url);
}).listen(config.port, "127.0.0.1");

console.log('SparkleShare-Web is running at http://127.0.0.1:' + config.port);

