var events = require('events');
var util = require('util');
var underscore = require('underscore');
var dateformat = require("dateformat");
var async = require("async");

exports.init = function(db, cb) {
  exports.db = db;

  // Write to DB every two seconds...
  exports.inLogic = 0;
  exports.db.run(
    "begin transaction",
    function (err) {
      if (err) { return console.log(err); }
      setInterval(function () {
        if (exports.inLogic) return;
        exports.db.run(
          "end transaction",
          function (err) {
            if (err) { return console.log(err); }
            // console.log("COMMIT");
            exports.db.run(
              "begin transaction",
               function (err) {
                 if (err) { return console.log(err); }
               }
            );
          });
      }, 1000);

      async.map(
        ["create table events (id integer primary key autoincrement, timestamp timestamp, class varchar(32), data text, device varchar(256), lat real, lon real)",
         "create table vessels (id integer primary key autoincrement, mmsi varchar(256), last_seen integer references events(id))",
         "create table events_ais (id integer references events(id), vessel_id integer references vessels(id))",
         "create table devices (id integer primary key autoincrement, name varchar(256), last_seen integer references events(id))"],
        function (item, cb) { exports.db.run(item, cb); },
       cb);
    });
}

exports.callInOneTransaction = function (fn, cb) {
  exports.inLogic++;
  fn(function () {
    exports.inLogic--;
    cb();
  });
}

exports.getDevices = function (cb) {
  var devices = [];
  exports.db.each(
    "select devices.name as name, events.data as data from devices join events on devices.last_seen = events.id",
    function(err, row) {
      var data = JSON.parse(row.data);
      if (data.class == 'DEVICES') {
        data = data.devices.filter(function (device) { return device.path == row.name; })[0];
      }
      devices.push(data);
    },
    function(err, rows) {
      cb(err, devices);
    }
  );
}

exports.getVessels = function (cb) {
  var vessels = [];
  exports.db.each(
    "select * from vessels",
    function(err, row) {
      vessels.push(row);
    },
    function(err, rows) {
      cb(err, vessels);
    }
  );
}

exports.getRouteSql = function (query) {
  var sql = query.sql;
  var params = underscore.clone(query.params); 

  sql = "select * from (" + sql + ") where lon is not null and lat is not null";

  if (query.timemin != undefined) {
    sql = sql + " and timestamp >= $timemin";
    params.$timemin = query.timemin;
  }
  if (query.timemax != undefined) {
    sql = sql + " and timestamp <= $timemax";
    params.$timemax = query.timemax;
  }

  var regionsql = [];
  if (query.latmin != undefined) { regionsql.push("lat >= $latmin"); }
  if (query.lonmin != undefined) { regionsql.push("lon >= $lonmin"); }
  if (query.latmax != undefined) { regionsql.push("lat <= $latmax"); }
  if (query.lonmax != undefined) { regionsql.push("lon <= $lonmax"); }
  if (regionsql.length) {
    regionsql = regionsql.join(' and ');
    sql = sql + " and " + regionsql;

    params.$latmin = query.latmin;
    params.$lonmin = query.lonmin;
    params.$latmax = query.latmax;
    params.$lonmax = query.lonmax;
  }

  if (query.maxentries != undefined) {
    countSql = exports.getCountSql({sql: sql, params:params});

    sql = sql + " and random() % (" + countSql.sql + ") / $maxentries = 0";
    params = countSql.params;
    params.$maxentries = query.maxentries;
  }
  
  sql = sql + " order by timestamp asc";

  return {
    sql: sql,
    params: params
  }
}

exports.getCountSql = function (query) {
  var sql = query.sql;
  var params = underscore.clone(query.params); 

  return {
    sql: "select count(*) as count from (" + sql + ")",
    params: params
  };
}

exports.onlyWithRoute = function (query, routecb, cb) {
  var sql = exports.getCountSql(exports.getRouteSql(query));

  exports.db.get(
    sql.sql,
    sql.params,
    function(err, row) {
      if (err) { console.log(err); return cb(); }
      if (row.count == 0) { return cb(); }
      routecb(cb);
    }
  );

}

exports.getRoute = function (query, cb) {
  var sql = exports.getRouteSql(query);

  console.log("QUERY");
  console.log(sql.sql);
  console.log(sql.params);
  console.log("\n\n");
  exports.db.all(
    sql.sql,
    sql.params,
    function(err, rows) {
      if (err) return cb(err);
      cb(null, rows.map(function (row) { return JSON.parse(row.data); }));
    });
};

exports.Logger = function() {
  var self = this;

  self.on('receiveCommand_WATCH', function (params) {
    exports.db.get(
      "select data from events where class not in ('VERSION', 'DEVICES', 'DEVICE', 'WATCH', 'REPLAY') order by timestamp desc limit 1",
      function(err, row) {
        self.sendResponse(JSON.parse(row.data));
    });
  });

  self.on('receiveCommand_REPLAY', function (params) {
    if (params.from) {
      exports.db.each(
        "select data from events where class not in ('VERSION', 'DEVICES', 'DEVICE', 'WATCH', 'REPLAY') and timestamp > ? order by timestamp asc",
        params.from,
        function(err, row) {
          self.sendResponse(JSON.parse(row.data));
      });
    } else {
      exports.db.each(
        "select data from events where class not in ('VERSION', 'DEVICES', 'DEVICE', 'WATCH', 'REPLAY') order by timestamp asc",
        function(err, row) {
          self.sendResponse(JSON.parse(row.data));
      });
    }
  });

  self.on('receiveResponse_VERSION_REPLAY', function (data) {
    exports.db.get(
      "select timestamp from events where class not in ('VERSION', 'DEVICES', 'DEVICE', 'WATCH', 'REPLAY') order by timestamp desc limit 1",
      function(err, row) {
        if (err || !row) {
          self.sendCommand("REPLAY", {});
        } else {
          self.sendCommand("REPLAY", {from:row.timestamp});
        }
      }
    );
  });

  self.on('receiveResponse', function (response) {
    exports.db.run(
      "insert into events (timestamp, class, data, device, lat, lon) values ($timestamp, $class, $data, $device, $lat, $lon)",
      {$timestamp:response.time,
       $class:response.class,
       $data:JSON.stringify(response),
       $device:response.device,
       $lat:response.lat,
       $lon:response.lon},
      function (err) {
        if (err) { console.log(err); return; }
        response.id = this.lastID;
        self.emit("saveResponse", response);
      }
    );
  });

  self.on('saveResponse', function (response) {
    if (response.class) {
      self.emit('saveResponse_' + response.class, response);
    }
    if (response.device) {
      self.emit('saveDevice', {path:response.device, id:response.id, dont_update_last_seen: true});
    }
  });

  self.saveDeviceQueue = async.queue(function (data, cb) {
    exports.callInOneTransaction(
      function (cb) {
        exports.db.get(
          "select count(*) as count from devices where name = $name",
          {$name: data.path},
          function(err, row) {
            if (err) { console.warn(err); return cb(); }
            if (row.count > 0) {
              if (data.dont_update_last_seen) { return cb(); }
              exports.db.run(
                "update devices set last_seen = $id where name = $path",
                {$path:data.path,
                 $id:data.id},
                 function (err) { if (err) { console.warn(err); } cb(); });
            } else {
              exports.db.run(
                "insert into devices (name, last_seen) values ($path, $id)",
                {$path:data.path,
                 $id:data.id},
                function (err) { if (err) { console.warn(err); } cb(); });
            }
        });
      },
      cb);
  }, 1);

  self.on('saveDevice', function (data) {
    self.saveDeviceQueue.push(data);
  });

  self.on('saveResponse_DEVICE', function (data) {
    self.emit('saveDevice', data);
  });

  self.on('saveResponse_DEVICES', function (data) {
    data.devices.map(function (device) {
      device.id = data.id;
      self.emit('saveDevice', device);
    });
  });


  self.on('receiveCommand_WATCH', function (params) {
    exports.getDevices(function (err, devices) {
      devices.map(function (device) {
        self.sendResponse(device);
      });
    });
  });

  self.on("serverInitialResponse", function () {
    exports.getDevices(function (err, devices) {
      self.sendResponse({class: 'DEVICES',
                         devices: devices});
    });
  });

  self.on('saveAIS', function (data) {
    exports.db.run(
      "insert into events_ais (id, vessel_id) values ($event, $vessel)",
      {$event:data.event.id,
       $vessel:data.vessel.id});
  });

  self.saveVesselQueue = async.queue(function (data, cb) {
    exports.callInOneTransaction(
      function (cb) {
        var next = function (err) {
          if (err) { console.warn(err); return cb(); }
          exports.db.get(
            "select id from vessels where mmsi = $mmsi",
            {$mmsi:data.mmsi},
            function(err, row) {
              if (err) { console.warn(err); return cb(); }
              self.emit("saveAIS", {event:data, vessel: {id:row.id}});
              cb();
            });
        }

        exports.db.get(
          "select count(*) as count from vessels where mmsi = $mmsi",
          {$mmsi: data.mmsi},
          function(err, row) {
            if (err) { console.warn(err); return cb(); }
            if (row.count > 0) {
              exports.db.run(
                "update vessels set last_seen = $id where mmsi = $mmsi",
                {$mmsi:data.mmsi,
                 $id:data.id},
                next);
            } else {
              exports.db.run(
                "insert into vessels (mmsi, last_seen) values ($mmsi, $id)",
                {$mmsi:data.mmsi,
                 $id:data.id},
                next);
            }
        });
      },
      cb);
  }, 1);

  self.on('saveVessel', function (data) {
    self.saveVesselQueue.push(data);
  });
  

  self.on('saveResponse_AIS', function (data) {
    self.emit("saveVessel", data);
  });

};
