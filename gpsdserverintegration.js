var events = require('events');
var util = require('util');
var underscore = require('underscore');
var gpsdserver = require('./gpsdserver');
var net = require('net');
var dateformat = require("dateformat");

exports.Server = function(stream, app) {
  var self = this;
  gpsdserver.Server.call(self, stream);

  stream.name = stream.remoteAddress + ":" + stream.remotePort
  app.serverSockets[stream.name] = self;

  self.on('receive_WATCH', function (params) {
    self.watch = params.enable;
    app.db.get(
      "select data from events where class not in ('VERSION', 'DEVICES', 'WATCH', 'REPLAY') order by timestamp desc limit 1",
      function(err, row) {
        self.send(JSON.parse(row.data));
    });
  });

  self.on('receive_REPLAY', function (params) {
    self.watch = true;
    if (params.from) {
      app.db.each(
        "select data from events where class not in ('VERSION', 'DEVICES', 'WATCH', 'REPLAY') and timestamp > ? order by timestamp asc",
        params.from,
        function(err, row) {
          self.send(JSON.parse(row.data));
      });
    } else {
      app.db.each(
        "select data from events where class not in ('VERSION', 'DEVICES', 'WATCH', 'REPLAY') order by timestamp asc",
        function(err, row) {
          self.send(JSON.parse(row.data));
      });
    }
  });

  stream.on("end", function () {
    delete app.selfs[socket.name];
  });
}
util.inherits(exports.Server, gpsdserver.Server);
