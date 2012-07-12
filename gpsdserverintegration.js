var events = require('events');
var util = require('util');
var underscore = require('underscore');
var protocol = require('./protocol');
var net = require('net');
var dateformat = require("dateformat");

exports.Server = function(stream, app) {
  var self = this;
    protocol.Protocol.call(self, stream, false);

  stream.name = stream.remoteAddress + ":" + stream.remotePort
  app.serverSockets[stream.name] = self;

  self.on('receiveCommand_WATCH', function (params) {
    self.watch = params.enable;
    app.db.get(
      "select data from events where class not in ('VERSION', 'DEVICES', 'DEVICE', 'WATCH', 'REPLAY') order by timestamp desc limit 1",
      function(err, row) {
        self.sendResponse(JSON.parse(row.data));
    });
  });

  self.on('receiveCommand_REPLAY', function (params) {
    self.watch = true;
    if (params.from) {
      app.db.each(
        "select data from events where class not in ('VERSION', 'DEVICES', 'DEVICE', 'WATCH', 'REPLAY') and timestamp > ? order by timestamp asc",
        params.from,
        function(err, row) {
          self.sendResponse(JSON.parse(row.data));
      });
    } else {
      app.db.each(
        "select data from events where class not in ('VERSION', 'DEVICES', 'DEVICE', 'WATCH', 'REPLAY') order by timestamp asc",
        function(err, row) {
          self.sendResponse(JSON.parse(row.data));
      });
    }
  });

  stream.on("end", function () {
    delete app.serverSockets[stream.name];
  });

  stream.on("error", function (err) {
    console.log([stream.name, err]);
    delete app.serverSockets[stream.name];
  });
}
util.inherits(exports.Server, protocol.Protocol);
