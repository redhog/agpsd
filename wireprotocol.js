var events = require('events');
var util = require('util');
var underscore = require('underscore');
var dateformat = require("dateformat");
var dateformat = require("dateformat");
var argv = require("./argvparser");
var os = require("os");

exports.WireProtocol = function(stream, isClient, reverseRoles) {
  var self = this;
  events.EventEmitter.call(self);

  self.isClient = isClient;
  self.closed = false;
  self.data = "";
  self.stream = stream;

  var remote = self.stream.remoteAddress;
  if (remote == "127.0.0.1" || remote == "localhost") {
    remote = os.hostname();
  }
  var remotePort = self.stream.remotePort;
  if (remotePort != 4711) {
    remote += ":" + remotePort;
  }
  self.name = remote;

  if (argv.options.verbose && underscore.include(argv.options.verbose, 'connect')) {
    console.log("Connection opened from " + self.name);
  }

  stream.on("error", function (err) {
    console.log([self.name, err]);
    self.closed = true;
  });

  stream.on("end", function () {
    self.closed = true;
  });

  self.sendCommand = function (cmd, params) {
    self.stream.write("?" + cmd + "=" + JSON.stringify(params) + "\n");
  };

  self.sendResponse = function (data) {
    if (self.closed) return;
    //if (data.device) data.device = "/agpsd";
    data = JSON.stringify(data) + "\r\n";
    // console.log("S>" + data + "<");
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
        var cmd =  line[1];
        var args = JSON.parse(line[2]);
        if (argv.options.verbose && underscore.include(argv.options.verbose, 'data')) {
          console.log(["C", cmd, args]);
        }
        self.emit('receiveCommand', cmd, args);
      } else {
        line = line.match(/(.*[^;\r\n]);?/)[1];
        var response = JSON.parse(line);
        if (argv.options.verbose && underscore.include(argv.options.verbose, 'data')) {
          console.log(["R", response]);
        }
        self.emit('mangleResponse', response);
        self.emit('receiveResponse', response);
      }
    };
  });

  self.on('directionChange', function (isClient) {
    self.isClient = isClient;
  });

  self.on('mangleResponse', function (response) {
    if (!response.time) {
      response.time = dateformat((new Date()), "isoDateTime");
    }
    if (response.device && response.device.indexOf("://") == -1) {
      response.device = "agpsd://" + self.name + response.device;
    }
    if (response.path && response.path.indexOf("://") == -1) {
      response.path = "agpsd://" + self.name + response.path;
    }
    if (response.devices) {
      response.devices.map(function (device) {
        if (device.path && device.path.indexOf("://") == -1) {
          device.path = "agpsd://" + self.name + device.path;
        }

      });
    }
  });

  self.on('receiveResponse', function (data) {
    process.stdout.write(".");
    if (data.class) {
      self.emit('receiveResponse_' + data.class, data);
    }
  });

  self.on('receiveResponse_VERSION', function (data) {
    if (reverseRoles) {
      if (data.capabilities && underscore.include(data.capabilities, 'reverseroles')) {
        self.sendCommand("REVERSEROLES", {});
      } else {
        console.log("Role reversal not supported for " + self.name);
        self.closed = true;
        self.stream.end()
      }
    } else {
      if (data.capabilities && underscore.include(data.capabilities, 'replay')) {
        self.emit('receiveResponse_VERSION_REPLAY', data);
      } else {
        self.emit('receiveResponse_VERSION_WATCH', data);
      }
    }
  });

  self.on('receiveResponse_VERSION_WATCH', function (data) {
    self.sendCommand("WATCH", {"enable":true,"json":true});
  });

  self.on('receiveCommand', function (cmd, params) {
    self.emit('receiveCommand_' + cmd, params);
  });

  self.on('receiveCommand_REVERSEROLES', function (params) {
    self.emit('directionChange', true);
    self.sendCommand("ROLESREVERSED", {});
  });

  self.on('receiveCommand_ROLESREVERSED', function (params) {
    self.emit('directionChange', false);
    self.emit('serverInitialResponse');
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
  });

  self.on('receiveComnmand_REPLAY', function (params) {
    self.sendResponse({class: 'REPLAY',
                       from: params.from});
  });

  self.on("serverInitialResponse", function () {
    self.sendResponse({class: 'VERSION',
                       release: '3.4',
                       rev: '3.4',
                       proto_major: 3,
                       proto_minor: 6,
                       capabilities: ["replay", "reverseroles"]});
  });

  if (!self.isClient) {
    setTimeout(function () { self.emit("serverInitialResponse"); }, 0);
  }
}
util.inherits(exports.WireProtocol, events.EventEmitter);
