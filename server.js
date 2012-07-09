#! /usr/bin/node

var net = require('net');
var sqlite3 = require("sqlite3");
var argv = require("./argvparser");
var gpsdclientintegration = require("./gpsdclientintegration");
var gpsdserver = require("./gpsdserver");

var dbname = 'agpsd.db';
if (argv.options.db && argv.options.db.length > 0) {
  dbname = argv.options.db[0];
}
exports.db = new sqlite3.Database(dbname);
exports.db.run(
  "create table events (timestamp timestamp, class varchar(32), data text)",
  function (err) {
    var serverSockets = {};
    var server = net.createServer(function (socket) {
      socket.name = socket.remoteAddress + ":" + socket.remotePort
      var serverSocket = serverSockets[socket.name] = new gpsdserver.Server(socket);

      serverSocket.on('receive_WATCH', function (params) {
        serverSocket.watch = params.enable;
        exports.db.get(
          "select data from events where class not in ('VERSION', 'DEVICES', 'WATCH', 'REPLAY') order by timestamp desc limit 1",
          function(err, row) {
            serverSocket.send(JSON.parse(row.data));
        });
      });

      serverSocket.on('receive_REPLAY', function (params) {
        serverSocket.watch = true;
        if (params.from) {
          exports.db.each(
            "select data from events where class not in ('VERSION', 'DEVICES', 'WATCH', 'REPLAY') and timestamp > ? order by timestamp asc",
            params.from,
            function(err, row) {
              serverSocket.send(JSON.parse(row.data));
          });
        } else {
          exports.db.each(
            "select data from events where class not in ('VERSION', 'DEVICES', 'WATCH', 'REPLAY') order by timestamp asc",
            function(err, row) {
              serverSocket.send(JSON.parse(row.data));
          });
        }
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
          var client = new gpsdclientintegration.Client(val[0], val[1], exports);
      });
    }

    console.log("Listening for connections on " + port);
  }
);
