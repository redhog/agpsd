var express = require('express');
var logger = require('./logger');

var listify = function (x) {
  if (!x) return [];
  if (typeof(x) == "string") return [x];
  return x;
}

exports.getKml = function(req, res) {
  console.log(req.query);

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
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<kml xmlns="http://www.opengis.net/kml/2.2">' +
      '  <Document>' +
      '    <name>AGPS exported route</name>' +
      '    <description>AGPS exported route</description>',
      '  </Document>' +
      '</kml>',
      content,
      function () {
        res.end();
        done();
      }
    );
  }

  var sendRoute = function (name, coordinates, done) {
    wrap(
      '    <Placemark>' +
      '      <name>' + name + ' - route</name>' +
      '      <description>Route</description>' +
      '      <LineString>' +
      '        <extrude>1</extrude>' +
      '        <tessellate>1</tessellate>' +
      '        <altitudeMode>absolute</altitudeMode>' +
      '        <coordinates>',
      '        </coordinates>' +
      '      </LineString>' +
      '    </Placemark>',
      coordinates,
      done
    );
  }

  var sendPoint = function (name, coordinates, done) {
    wrap(
      '    <Placemark>' +
      '      <name>' + name + ' - Last known position</name>' +
      '      <description>Last known position</description>' +
      '      <Point>' +
      '        <coordinates>',
      '        </coordinates>' +
      '      </Point>' +
      '    </Placemark>',
      coordinates,
      done
    );
  }

  var sendDevice = function (device, cb) {
    sendRoute(
      device,
      function (cb) {
        exports.db.each(
          "select data from events where class = 'TPV' and device = $device and lon is not null and lat is not null order by timestamp asc",
          {$device: device},
          function(err, row) {
            if (err) return console.log(err);
            var data = JSON.parse(row.data);
            last = data;
            res.write(data.lon + "," + data.lat + "," + (data.alt || 0) + "\n");
          },
          cb
        );
      },
      function () {
        if (!last) return cb();
        sendPoint(
          device,
          function (cb) {
            res.write(last.lon + "," + last.lat + "," + (last.alt || 0) + "\n");
            cb();
          },
          cb);
      }
    );
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

  var last = null;
  sendKml(
    function (cb) {
      if (req.query.devices) {
        sendDevices(listify(req.query.devices).map(unescape), cb);
      } else {
        logger.getDevices(function (err, devices) {
          sendDevices(devices.map(function (device) { return device.path; }), cb);
        });
      }
    },
    function () {}
  );
}
