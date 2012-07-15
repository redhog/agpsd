var events = require('events');
var util = require('util');
var underscore = require('underscore');
var protocol = require('./protocol');
var net = require('net');
var dateformat = require("dateformat");

exports.Server = function(stream) {
  var self = this;
  protocol.Protocol.call(self, stream, false);
}
util.inherits(exports.Server, protocol.Protocol);
