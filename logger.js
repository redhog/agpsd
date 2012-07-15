var events = require('events');
var util = require('util');
var underscore = require('underscore');
var dateformat = require("dateformat");

exports.init = function(db) {
  exports.db = db;
}

exports.Logger = function() {
  var self = this;

  self.on('receiveCommand_WATCH', function (params) {
    exports.db.get(
      "select data from events where class not in ('VERSION', 'DEVICES', 'DEVICE', 'WATCH', 'REPLAY') order by timestamp desc limit 1",
      function(err, row) {
        self.sendResponse(JSON.parse(row.data));
    });
  });

  self.on('receiveCommand_REPLAY', function (params) {
    if (params.from) {
      exports.db.each(
        "select data from events where class not in ('VERSION', 'DEVICES', 'DEVICE', 'WATCH', 'REPLAY') and timestamp > ? order by timestamp asc",
        params.from,
        function(err, row) {
          self.sendResponse(JSON.parse(row.data));
      });
    } else {
      exports.db.each(
        "select data from events where class not in ('VERSION', 'DEVICES', 'DEVICE', 'WATCH', 'REPLAY') order by timestamp asc",
        function(err, row) {
          self.sendResponse(JSON.parse(row.data));
      });
    }
  });

  self.on('receiveResponse_VERSION_REPLAY', function (data) {
    exports.db.get(
      "select timestamp from events where class not in ('VERSION', 'DEVICES', 'DEVICE', 'WATCH', 'REPLAY') order by timestamp desc limit 1",
      function(err, row) {
        if (err || !row) {
          self.sendCommand("REPLAY", {});
        } else {
          self.sendCommand("REPLAY", {from:row.timestamp});
        }
      }
    );
  });

  self.on('receiveResponse', function (response) {
    if (!response.time) {
      response.time = dateformat((new Date()), "isoDateTime");
    }
    exports.db.run("insert into events (timestamp, class, data) values ($timestamp, $class, $data)", {$timestamp:response.time, $class:response.class, $data:JSON.stringify(response)});
  });
};
