var events = require('events');
var util = require('util');
var underscore = require('underscore');
var protocol = require('./protocol');
var net = require('net');
var dateformat = require("dateformat");

exports.Connector = function(host, port, reverseRoles) {
  var reconnect = function () {
    setTimeout(function () {
      console.log("Reconnect");
      new exports.Connector(host, port, reverseRoles);
    }, 2000);
  }
  var self = this;
  var stream = net.createConnection(port, host);
  stream.on("error", function (err) {
    console.log(err);
    stream.destroy();
    reconnect();
  });
  stream.on("timeout", function () {
    console.log("Timeout");
    self.stream.end();
  });
  stream.on("end", function () {
    console.log("End");
    reconnect();
  });
  stream.on("connect", function () {
    protocol.Protocol.call(self, stream, true, reverseRoles);
    self.stream.setTimeout(2000);
  });
}
util.inherits(exports.Connector, protocol.Protocol);
