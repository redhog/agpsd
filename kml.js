var express = require('express');

exports.getKml = function(req, res) {
  // console.log(req.query);

  var kml1 = '' +
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<kml xmlns="http://www.opengis.net/kml/2.2">' +
    '  <Document>' +
    '    <name>AGPS exported route</name>' +
    '    <description>AGPS exported route</description>' +
    '    <Placemark>' +
    '      <name>Route</name>' +
    '      <description>Route</description>' +
    '      <LineString>' +
    '        <extrude>1</extrude>' +
    '        <tessellate>1</tessellate>' +
    '        <altitudeMode>absolute</altitudeMode>' +
    '        <coordinates>';

  var kml2 = '' +
    '        </coordinates>' +
    '      </LineString>' +
    '    </Placemark>' +
    '    <Placemark>' +
    '      <name>Last known position</name>' +
    '      <description>Last known position</description>' +
    '      <Point>' +
    '        <coordinates>';

  var kml3 = '' +
    '        </coordinates>' +
    '      </Point>' +
    '    </Placemark>' +
    '  </Document>' +
    '</kml>';

  res.header('Content-type', 'application/vnd.google-earth.kml+xml');
  res.write(kml1);
  var last = null;
  exports.db.each(
    "select data from events where class = 'TPV' and lon is not null and lat is not null order by timestamp asc",
    function(err, row) {
      if (err) return console.log(err);
      var data = JSON.parse(row.data);
      last = data;
      res.write(data.lon + "," + data.lat + "," + (data.alt || 0) + "\n");
    },
    function (err, rows) {
      if (err) return console.log(err);
      res.write(kml2); 
      res.write(last.lon + "," + last.lat + "," + (last.alt || 0) + "\n");
      res.write(kml3);
      res.end();
   });
}