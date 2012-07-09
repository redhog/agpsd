#! /usr/bin/node

var net = require('net');
var sqlite3 = require("sqlite3");
var dateformat = require("dateformat");
var argv = require("./argvparser");
var gpsdclient = require("./gpsdclient");
var gpsdserver = require("./gpsdserver");

var dbname = 'agpsd.db';
if (argv.options.db && argv.options.db.length > 0) {
  dbname = argv.options.db[0];
}
var db = new sqlite3.Database(dbname);
db.run(
  "create table events (timestamp timestamp, class varchar(32), data text)",
  function (err) {
    var serverSockets = {};
    var server = net.createServer(function (socket) {
      socket.name = socket.remoteAddress + ":" + socket.remotePort
      var serverSocket = serverSockets[socket.name] = new gpsdserver.Server(socket);

      serverSocket.on('receive_WATCH', function (params) {
        serverSocket.watch = params.enable;
        db.get(
          "select data from events where class not in ('VERSION', 'DEVICES', 'WATCH', 'REPLAY') order by timestamp desc limit 1",
          function(err, row) {
            serverSocket.send(JSON.parse(row.data));
        });
      });

      serverSocket.on('receive_REPLAY', function (params) {
        serverSocket.watch = true;
        if (params.from) {
          db.each(
            "select data from events where class not in ('VERSION', 'DEVICES', 'WATCH', 'REPLAY') and timestamp > ? order by timestamp asc",
            params.from,
            function(err, row) {
              serverSocket.send(JSON.parse(row.data));
          });
        } else {
          db.each(
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
        var client = new gpsdclient.Client(net.createConnection(val[1], val[0]));
        client.on('receive_VERSION_REPLAY', function (data) {
          db.get(
            "select timestamp from events where class not in ('VERSION', 'DEVICES', 'WATCH', 'REPLAY') order by timestamp desc limit 1",
            function(err, row) {
              if (err || !row) {
                client.send("REPLAY", {});
              } else {
                client.send("REPLAY", {from:row.timestamp});
              }
            }
          );
        });

        client.on('receive', function (response) {
          if (!response.time) {
            response.time = dateformat((new Date()), "isoDateTime");
          }
          db.run("insert into events (timestamp, class, data) values ($timestamp, $class, $data)", {$timestamp:response.time, $class:response.class, $data:JSON.stringify(response)});
          for (var name in serverSockets) {
            var serverSocket = serverSockets[name];
            if (serverSocket.watch) {
              serverSocket.send(response);
            }
          }
          console.log(".");
        });  
      });
    }

    console.log("Listening for connections on " + port);
  }
);
