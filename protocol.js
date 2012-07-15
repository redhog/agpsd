var wireprotocol = require('./wireprotocol');
var router = require('./router');
var logger = require('./logger');
var util = require('util');
var underscore = require('underscore');
var dateformat = require("dateformat");
var dateformat = require("dateformat");

exports.Protocol = function(stream, isClient) {
  var self = this;
  wireprotocol.WireProtocol.call(self, stream, isClient);
  router.Router.call(self);
  logger.Logger.call(self);

}
util.inherits(exports.Protocol, wireprotocol.WireProtocol);
