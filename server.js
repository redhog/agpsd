#! /usr/bin/node

var net = require('net');
var sqlite3 = require("sqlite3");
var argv = require("./argvparser");
var gpsdclient = require("./gpsdclient");
var gpsdserver = require("./gpsdserver");


var db = new sqlite3.Database('agpsd.db');
db.run("create table events (timestamp timestamp, data text)", function (err) {});

var serverSockets = {};
var server = net.createServer(function (socket) {
  socket.name = socket.remoteAddress + ":" + socket.remotePort
  serverSockets[socket.name] = new gpsdserver.Server(socket);

  serverSockets[socket.name].on('receive_WATCH', function (params) {
    db.get(
     "select data from events where timestamp is not null order by timestamp desc limit 1",
     function(err, row) {
       serverSockets[socket.name].send(JSON.parse(row.data));
    });
  });

  socket.on("end", function () {
    delete serverSockets[socket.name];
  });
})
var port = 4711;
if (argv.options.listen && argv.options.listen.length > 0) {
  port = argv.options.listen[0];
}
server.listen(port);



if (argv.options.upstream) {
  argv.options.upstream.forEach(function (val, index) {
    val = val.split(":");
    var client = new gpsdclient.Client(net.createConnection(val[1], val[0]));
    client.on('receive', function (response) {
      db.run("insert into events (timestamp, data) values ($timestamp, $data)", {$timestamp:response.time, $data:JSON.stringify(response)});
      for (var name in serverSockets) {
        var serverSocket = serverSockets[name];
        serverSocket.send(response);
      }
      console.log(".");
    });  
  });
}


console.log("Listening for connections on " + port);