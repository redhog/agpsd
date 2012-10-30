var events = require('events');
var util = require('util');
var underscore = require('underscore');
var protocol = require('./protocol');
var net = require('net');
var dateformat = require("dateformat");
var argv = require("./argvparser");

exports.StreamInput = function(stream, reverseRoles) {
  var self = this;
  stream.on("error", function (err) {
    if (argv.options.verbose && underscore.include(argv.options.verbose, 'disconnect')) {
      console.log(err);
    }
    stream.destroy();
  });
  stream.on("timeout", function () {
    if (argv.options.verbose && underscore.include(argv.options.verbose, 'disconnect')) {
      console.log("Timeout");
    }
    self.stream.end();
  });
  stream.on("end", function () {
    if (argv.options.verbose && underscore.include(argv.options.verbose, 'disconnect')) {
      console.log("End");
    }
  });
  protocol.Protocol.call(self, stream, true, reverseRoles);
}
util.inherits(exports.StreamInput, protocol.Protocol);
