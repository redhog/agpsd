var events = require('events');
var util = require('util');
var underscore = require('underscore');
var dateformat = require("dateformat");
var dateformat = require("dateformat");

exports.Protocol = function(stream, isClient) {
  var self = this;
  events.EventEmitter.call(self);

  self.closed = false;
  self.isClient = isClient;
  self.data = "";
  self.stream = stream;

  self.sendCommand = function (cmd, params) {
    self.stream.write("?" + cmd + "=" + JSON.stringify(params) + "\n");
  };

  self.sendResponse = function (data) {
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
      if (line.indexOf("?") == 0) {
        line = line.match(/\?([^=]*)\=(.*[^;\r\n])/);
        self.emit('receiveCommand', line[1], JSON.parse(line[2]));
      } else {
        line = line.match(/(.*[^;\r\n]);?/)[1];
        self.emit('receiveResponse', JSON.parse(line));
      }
    };
  });

  self.on('receiveResponse', function (data) {
    if (data.class) {
      self.emit('receiveResponse_' + data.class, data);
    }
  });

  self.on('receiveResponse_VERSION', function (data) {
    if (data.capabilities && underscore.include(data.capabilities, 'replay')) {
      self.emit('receiveResponse_VERSION_REPLAY', data);
    } else {
      self.emit('receiveResponse_VERSION_WATCH', data);
    }
  });

  self.on('receiveResponse_VERSION_WATCH', function (data) {
    self.sendCommand("WATCH", {"enable":true,"json":true});
  });

  self.on('receiveCommand', function (cmd, params) {
    self.emit('receiveCommand_' + cmd, params);
  });

  self.on('receiveCommand_WATCH', function (params) {
    if (!params.json) console.log("UNSUPPORTED WATCH");
    var data = underscore.extend({class: 'WATCH',
                                   enable: true,
                                   json: true,
                                   nmea: false,
                                   raw: 0,
                                   scaled: false,
                                   timing: false }, params);   
    self.sendResponse(data);
    self.sendResponse({"class":"DEVICE","path":"/agpsd","activated":dateformat((new Date()), "isoDateTime"),
                       "driver":"AGPSD","native":1,"cycle":1.00});
  });

  self.on('receiveComnmand_REPLAY', function (params) {
    self.sendResponse({class: 'REPLAY',
                       from: params.from});
  });

  if (!self.isClient) {
    self.sendResponse({class: 'VERSION',
                       release: '3.4',
                       rev: '3.4',
                       proto_major: 3,
                       proto_minor: 6,
                       capabilities: ["replay"]});

    self.sendResponse({class: 'DEVICES',
                       devices: 
                       [{class: 'DEVICE',
                         path: '/agpsd',
                         activated: dateformat((new Date()), "isoDateTime"),
                         driver: 'AGPSD',
                         cycle: 1 }]});
  }
}
util.inherits(exports.Protocol, events.EventEmitter);
