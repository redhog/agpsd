var events = require('events');
var util = require('util');
var underscore = require('underscore');

exports.Server = function(stream) {
  var self = this;
  events.EventEmitter.call(self);

  self.data = "";
  self.stream = stream;

  self.send = function (data) {
    self.stream.write(JSON.stringify(data) + "\n");
  };

  self.stream.on('data', function(data) {
    self.data += data;
    var _terminator = /^([^\r\n]*[\r\n][\r\n]?)/;
    while (results = _terminator.exec(self.data)) {
      var line = results[1];
      self.data = self.data.slice(line.length);
      line = line.match(/\?([^=]*)\=(.*)/);
      self.emit('receive', line[1], JSON.parse(line[2]));
    };
  });

  self.on('receive', function (cmd, params) {
    self.emit('receive_' + cmd, params);
  });

  self.on('receive_WATCH', function (params) {
    if (!params.json) console.log("UNSUPPORTED WATCH");
    self.send({class: 'WATCH',
               enable: true,
               json: true,
               nmea: false,
               raw: 0,
               scaled: false,
               timing: false });
  });
  self.on('receive_REPLAY', function (params) {
    self.send({class: 'REPLAY',
               from: params.from});
  });

  self.send({class: 'VERSION',
             release: '3.4',
             rev: '3.4',
             proto_major: 3,
             proto_minor: 6,
             capabilities: ["replay"]});

  self.send({class: 'DEVICES',
             devices: 
             [{class: 'DEVICE',
               path: '/agpsd',
               activated: '2012-07-09T09:15:28.826Z',
               driver: 'AGPSD',
               cycle: 1 }]});
}
util.inherits(exports.Server, events.EventEmitter);