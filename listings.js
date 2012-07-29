var express = require('express');
var logger = require('./logger');

exports.getDevices = function(req, res) {
  logger.getDevices(function (err, devices) {
    res.header('Content-type', 'text/json');
    res.write(JSON.stringify({devices:devices}));
    res.end();
  });
}
