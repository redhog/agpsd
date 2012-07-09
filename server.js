var net = require('net');
var events = require('events');
var util = require('util');
var sqlite3 = require("sqlite3");

var Client = function(stream) {
  var self = this;
  events.EventEmitter.call(self);

  self.data = "";
  self.stream = stream;

  self.stream.on('data', function(data) {
    self.data += data;
    self.process();
  });

  self.process = function() {
    var _terminator = /^([^\r\n]*\r\n)/;
    while (results = _terminator.exec(self.data)) {
      var line = results[1];
      self.data = self.data.slice(line.length);
      self.emit('receive', JSON.parse(line));
    };
  };

  self.send = function (cmd, params) {
    self.stream.write("?" + cmd + "=" + JSON.stringify(params));
  };
}
util.inherits(Client, events.EventEmitter);

var db = new sqlite3.Database('agpsd.db');
db.run("create table events (timestamp timestamp, data text)", function (err) {});

var client = new Client(net.createConnection("2947", "localhost"));
client.on('receive', function (response) {
  db.run("insert into events (timestamp, data) values ($timestamp, $data)", {$timestamp:response.time, $data:JSON.stringify(response)});
  console.log(".");
});
client.send("WATCH", {"enable":true,"json":true});
