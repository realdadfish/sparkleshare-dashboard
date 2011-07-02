//   fanout.js
//
//   A fanout messaging server for node.js
//   by @jazzychad - Chad Etzel
//
//   + some modifications to be the default
//     messaging system for SparkleShare
//
//   MIT Licensed

// Usage: subscribe <channel>
//        unsubscribe <channel>
//        announce <channel> <message>
//        ping


var tcp = require("net"),
    sys = require("sys");

// The .bind method from Prototype.js 
Function.prototype.bind = function(){ 
    var fn = this, args = Array.prototype.slice.call(arguments), object = args.shift(); 
    return function() { 
        return fn.apply(object, args.concat(Array.prototype.slice.call(arguments))); 
    };
};

Array.prototype.remove = function(e) {
    for(var i = 0; i < this.length; i++)
        if(e == this[i]) this.splice(i, 1);
};

// Array Remove - By John Resig (MIT Licensed)
Array.remove = function(array, from, to) {
    var rest = array.slice((to || from) + 1 || array.length);
    array.length = from < 0 ? array.length + from : from;
    return array.push.apply(array, rest);
};

var msgEmitter = new process.EventEmitter();

var handleMessage = function handleMessage(conn, socket, data) {
    sys.puts('[' + conn.name + ']' + ' data: ' + data);

    if (data == "ping") {
       socket.write(Date.now() + "\n");

    } else if (data.indexOf("subscribe ") == 0) {
       conn.addchannel(data.split(' ')[1]);
       conn.subscribe();

    } else if (data.indexOf("unsubscribe ") == 0) {
       conn.removechannel(data.split(' ')[1]);

       // update subscriptions by calling subscribe
       conn.subscribe();

    } else if (data.indexOf("announce ") == 0) {
        data = data.substring(9);
        var pos = data.indexOf(' ');
        var channel = data.slice(0, pos);
        var msg = data.slice(pos + 1);
        msgEmitter.emit(channel, channel, msg);
    }
};

function Client(connection) {
    this.socket    = connection;
    this.name      = null;
    this.timer     = null;
    this.channels  = [];
    this.listeners = [];
}

// adds channel. must use "subscribe" to take effect
Client.prototype.addchannel = function(channel) {
    sys.puts('adding sub: ' + channel);

    this.removechannel(channel);
    this.channels.push(channel);
};

// removes channel. also removes associated listener immediately
Client.prototype.removechannel = function(channel) {
    sys.puts('removing sub');
    
    // remove channel if it exists
    this.channels.remove(channel);
    
    // remove listener
    var listener = this.listeners[channel];
    
    if (listener)
        msgEmitter.removeListener(channel, listener);
};

Client.prototype.subscribe = function() {
    sys.puts('subs:' + JSON.stringify(this.channels));

    this.channels.forEach(function(channel) {
        var listener = this.listeners[channel];
          
        if (listener)
          msgEmitter.removeListener(channel, listener);
      }.bind(this));

    this.listeners = [];
    this.channels.forEach(function(channel) {
        var listener = function(c, msg) {
          this.socket.write(c + "!" + msg + "\n");
        }.bind(this);

        this.listeners[channel] = listener;
        msgEmitter.addListener(channel, listener);
    }.bind(this));
};

Client.prototype.deconstruct = function() {
    this.channels.forEach(function(channel) {
        var listener = this.listeners[channel];

        if (listener)
            msgEmitter.removeListener(channel, listener);
    }.bind(this));
};

var connections = [];

var server = tcp.createServer(function(socket) {
    var conn = new Client(socket);
    connections.push(conn);
    conn.name = connections.length;
    socket.setTimeout(0);
    socket.setNoDelay();
    socket.setEncoding("utf8");

    sys.puts("client connected!");
    conn.addchannel("all");
    conn.subscribe();

    socket.addListener("connect", function() {
        socket.write("debug!connected...\n");
    });

    socket.addListener("data", function(data) {
        var dataarr = data.split("\n");
        var l = dataarr.length;

        for (var jj = 0; jj < dataarr.length - 1; jj++) {
          var dataline = dataarr[jj];
          handleMessage(conn, socket, dataline);
        }
    });
    
    socket.addListener("eof", function() {
        socket.close();
    });

    socket.addListener("end", function() {
        // unsubscribe from all here (remove all listeners)
        conn.deconstruct();
        connections.remove(conn);
        conn = null;
        sys.puts("Client connection closed.");
    });
});

var client_port = 1986;
server.listen(client_port);

