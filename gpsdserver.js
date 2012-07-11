var events = require('events');
var util = require('util');
var underscore = require('underscore');
var dateformat = require("dateformat");

exports.Server = function(stream) {
  var self = this;
  events.EventEmitter.call(self);

  self.data = "";
  self.stream = stream;

  self.closed = false;

  self.stream.on('close', function (cmd, params) {
    self.closed = true;
  });

  self.send = function (data) {
    if (self.closed) return;
    //if (data.device) data.device = "/agpsd";
    data = JSON.stringify(data) + "\r\n";
    console.log("S>" + data + "<");
    self.stream.write(data, function (err) {
      if (err) {
        console.error(err);
        self.stream.emit("end");
      }
    });
  };

  self.stream.on('data', function(data) {
    self.data += data;
    var _terminator = /^([^\r\n]*[\r\n][\r\n]?)/;
    while (results = _terminator.exec(self.data)) {
      var line = results[1];
      self.data = self.data.slice(line.length);
      console.log("R>" + line + "<");
      line = line.match(/\?([^=]*)\=(.*[^;\r\n])/);
      self.emit('receive', line[1], JSON.parse(line[2]));
    };
  });

  self.on('receive', function (cmd, params) {
    self.emit('receive_' + cmd, params);
  });

  self.on('receive_WATCH', function (params) {
    if (!params.json) console.log("UNSUPPORTED WATCH");
    var data = underscore.extend({class: 'WATCH',
                                   enable: true,
                                   json: true,
                                   nmea: false,
                                   raw: 0,
                                   scaled: false,
                                   timing: false }, params);   
    self.send(data);
    self.send({"class":"DEVICE","path":"/agpsd","activated":dateformat((new Date()), "isoDateTime"),
               "driver":"AGPSD","native":1,"cycle":1.00});
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
               activated: dateformat((new Date()), "isoDateTime"),
               driver: 'AGPSD',
               cycle: 1 }]});
}
util.inherits(exports.Server, events.EventEmitter);
