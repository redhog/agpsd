var events = require('events');
var util = require('util');
var underscore = require('underscore');

exports.Client = function(stream) {
  var self = this;
  events.EventEmitter.call(self);

  self.data = "";
  self.stream = stream;

  self.send = function (cmd, params) {
    self.stream.write("?" + cmd + "=" + JSON.stringify(params) + "\n");
  };

  self.stream.on('data', function(data) {
    self.data += data;
      var _terminator = /^([^\r\n]*[\r\n][\r\n]?)/;
    while (results = _terminator.exec(self.data)) {
      var line = results[1];
      self.data = self.data.slice(line.length);
      self.emit('receive', JSON.parse(line));
    };
  });

  self.on('receive', function (data) {
    if (data.class) {
      self.emit('receive_' + data.class, data);
    }
  });

  self.on('receive_VERSION', function (data) {
    if (data.capabilities && underscore.include(data.capabilities, 'replay')) {
      self.emit('receive_VERSION_REPLAY', data);
    } else {
      self.emit('receive_VERSION_WATCH', data);
    }
  });
  self.on('receive_VERSION_WATCH', function (data) {
    self.send("WATCH", {"enable":true,"json":true});
  });

}
util.inherits(exports.Client, events.EventEmitter);
