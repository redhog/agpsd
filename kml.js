var express = require('express');
var async = require('async');
var underscore = require('underscore');
var logger = require('./logger');

var listify = function (x) {
  if (!x) return [];
  if (typeof(x) == "string") return [x];
  return x;
}

exports.getKml = function(req, res) {
  var wrap = function (header, footer, content, done) {
    res.write(header);
    content(function () {
      res.write(footer);
      done();
    });
  }

  var sendKml = function (content, done) {
//    res.header('Content-type', 'application/vnd.google-earth.kml+xml');
    res.header('Content-type', 'text/plain');
    wrap(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<kml xmlns="http://www.opengis.net/kml/2.2">\n' +
      '  <Document>\n' +
      '    <name>AGPS exported route</name>\n' +
      '    <description>AGPS exported route</description>\n',
      '  </Document>\n' +
      '</kml>\n',
      content,
      function () {
        res.end();
        done();
      }
    );
  }

  var sendCoordinates = function (coordinates, done) {
    wrap(
      '', //<coordinates>\n',
      '', //</coordinates>\n',
      function (cb) {
        coordinates(function (err, rows) {
          if (err) { return console.log(err); }
          rows.map(
            function (row) {
              res.write(row.lon + "," + row.lat + "," + (row.alt || 0) + "\n");
            });
          cb();
        });
      },
      done
    );
  }


  var sendRoute = function (name, coordinates, done) {
    wrap(
      '    <Placemark>\n' +
      '      <name>' + name + ' - route</name>\n' +
      '      <description>Route</description>\n' +
      '      <LineString>\n' +
      '        <extrude>1</extrude>\n' +
      '        <tessellate>1</tessellate>\n' +
      '        <altitudeMode>absolute</altitudeMode>\n' +
      '        <coordinates>\n',
      '        </coordinates>\n' +
      '      </LineString>\n' +
      '    </Placemark>\n',
      function (cb) { sendCoordinates(coordinates, cb); },
      done
    );
  }

  var writePoint = function (point) {
    res.write('<Placemark>\n');
    res.write(
      '      <name>' + point.name + '</name>\n' +
      '      <description>' + (point.description || '') + '</description>\n' +
      '      <Point>\n' +
      '        <coordinates>\n' +
                 point.lon + "," + point.lat + "," + (point.alt || 0) + "\n" +
      '        </coordinates>\n' +
      '      </Point>\n');
    if (point.time) {
      res.write("<TimeStamp><when>" + (new Date(point.time)).toISOString() + "</when></TimeStamp>");
    }
    res.write('</Placemark>\n');
  }

  var sendDatabaseRoute = function (query, cb) {
    logger.onlyWithRoute(
      query,
      function (cb) {
        sendRoute(
          query.name,
          function (cb) {
            logger.getRoute(query, cb);
          },
          cb
        );
      },
      cb
    );
  }

  var sendDatabaseRoutePoints = function (query, cb) {
    logger.onlyWithRoute(
      query,
      function (cb) {
        exports.db.each(
          "select data from (" + query.sql + ") where lon is not null and lat is not null order by timestamp asc",
          query.params,
          function(err, row) {
            if (err) return console.log(err);
            var data = JSON.parse(row.data);
            data.name = query.name;
            writePoint(data);
          },
          cb
        );
      },
      cb
    );
  }

  var sendDevice = function (device, cb) {
    sendDatabaseRoute(
      underscore.extend({}, req.query, {
        name: device,
        sql: "select * from events where class = 'TPV' and device = $device and lon is not null and lat is not null order by timestamp asc",
        params: {$device: device}}),
      cb);
  }

  var sendDevices = function (devices, cb) {
    var i = 0;
    var next = function () {
      if (i >= devices.length) return cb();
      sendDevice(devices[i], function () {
        i++;
        next();
      });
    };
    next();
  }

  var sendVessel = function (vessel, cb) {
    sendDatabaseRoute(
      underscore.extend({}, req.query, {
        name: vessel.mmsi,
        sql: "select * from events join events_ais on events.id = events_ais.id where events.class = 'AIS' and events_ais.vessel_id = $vessel",
        params: {$vessel: vessel.id}}),
      function () {
        sendDatabaseRoutePoints({
          name: vessel.mmsi,
          sql: "select * from events join events_ais on events.id = events_ais.id where events.class = 'AIS' and events_ais.vessel_id = $vessel",
          params: {$vessel: vessel.id}},
          cb);
      });
  }

  var sendVessels = function (vessels, cb) {
    var i = 0;
    var next = function () {
      if (i >= vessels.length) return cb();
      sendVessel(vessels[i], function () {
        i++;
        next();
      });
    };
    next();
  }

  sendKml(
    function (cb) {
      async.series([
        function (cb) {
          if (req.query.devices) {
            sendDevices(listify(req.query.devices).map(unescape), cb);
          } else {
            logger.getDevices(function (err, devices) {
              sendDevices(devices.map(function (device) { return device.path; }), cb);
            });
          }
        },
        function (cb) {
          logger.getVessels(function (err, vessels) {
            sendVessels(vessels, cb);
          });
        }
      ], cb);
    },
    function () {}
  );
}
