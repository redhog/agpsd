#! /usr/bin/node

var net = require('net');
var sqlite3 = require("sqlite3");
var argv = require("./argvparser");
var logger = require("./logger");
var connector = require("./connector");
var listener = require("./listener");

var dbname = 'agpsd.db';
if (argv.options.db && argv.options.db.length > 0) {
  dbname = argv.options.db[0];
}
exports.serverSockets = {};
exports.db = new sqlite3.Database(dbname);
logger.init(exports.db);     
exports.db.run(
  "create table events (timestamp timestamp, class varchar(32), data text)",
  function (err) {
    var server = net.createServer(function (socket) {
      socket.name = socket.remoteAddress + ":" + socket.remotePort
      new listener.Listener(socket);
    })
    var port = 4711;
    if (argv.options.listen && argv.options.listen.length > 0) {
      port = argv.options.listen[0];
    }
    server.listen(port);

    if (argv.options.upstream) {
      argv.options.upstream.forEach(function (val, index) {
        val = val.split(":");
        new connector.Connector(val[0], val[1], false);
      });
    }

    if (argv.options.downstream) {
      argv.options.downstream.forEach(function (val, index) {
        val = val.split(":");
        new connector.Connector(val[0], val[1], true);
      });
    }

    console.log("Listening for connections on " + port);
  }
);
