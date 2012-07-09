exports.options = {};
exports.files = [];
for (var i = 2; i < process.argv.length; i++) {
  var arg = process.argv[i];
  if (arg.indexOf("--") == 0) {
    arg = arg.substr(2);
    if (arg.indexOf("=") != -1) {
      var splits = arg.match(/([^=]*)\=(.*)/);
      var name = splits[1];
      var value = splits[2];
      if (exports.options[name] == undefined) {
        exports.options[name] = [];
      }
      exports.options[name].push(value);
    } else {
      exports.options[arg] = null;
    }
  } else {
    exports.files.push(arg);
  }
}
