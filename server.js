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
var net = require('net');


function announcementServer() {

    this.create = function() {
        this.server = net.createServer(function (socket) {
          socket.write("Echo server\r\n");
          socket.pipe(socket);
        });


    }

    this.run = function() {
        this.running = true;
        this.server.listen(1337, "127.0.0.1");
        console.log('SparkleShare-Web is running at http://127.0.0.1:' + config.port_announce_in);
    }

    this.create();
}

server = new announcementServer();
server.run();