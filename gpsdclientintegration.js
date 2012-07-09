var events = require('events');
var util = require('util');
var underscore = require('underscore');
var gpsdclient = require('./gpsdclient');
var net = require('net');
var dateformat = require("dateformat");

exports.Client = function(host, port, app) {
  var self = this;
  gpsdclient.Client.call(self, net.createConnection(port, host));

  self.on('receive_VERSION_REPLAY', function (data) {
    app.db.get(
      "select timestamp from events where class not in ('VERSION', 'DEVICES', 'WATCH', 'REPLAY') order by timestamp desc limit 1",
      function(err, row) {
        if (err || !row) {
          self.send("REPLAY", {});
        } else {
          self.send("REPLAY", {from:row.timestamp});
        }
      }
    );
  });

  self.on('receive', function (response) {
    if (!response.time) {
      response.time = dateformat((new Date()), "isoDateTime");
    }
    app.db.run("insert into events (timestamp, class, data) values ($timestamp, $class, $data)", {$timestamp:response.time, $class:response.class, $data:JSON.stringify(response)});
    for (var name in app.serverSockets) {
      var serverSocket = app.serverSockets[name];
      if (serverSocket.watch) {
        serverSocket.send(response);
      }
    }
    console.log(".");
  });
}
util.inherits(exports.Client, gpsdclient.Client);
