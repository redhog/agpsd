var events = require('events');
var util = require('util');
var underscore = require('underscore');
var protocol = require('./protocol');
var net = require('net');
var dateformat = require("dateformat");

exports.Listener = function(stream) {
  var self = this;
  protocol.Protocol.call(self, stream, false);
}
util.inherits(exports.Listener, protocol.Protocol);
