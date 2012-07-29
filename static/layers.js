$(document).ready(function () {
    $.ajax({
      url: "/devices",
      dataType: "json",
      success: function (data) {
        var mapData = {
          div: "map",
          allOverlays: true,
          layers: [
            new OpenLayers.Layer.OSM(),
            new OpenLayers.Layer.Google("Google Streets")
          ],
        };
        data.devices.map(function (device) {
          mapData.layers.push(
            new OpenLayers.Layer.Vector(device.path, {
              strategies: [new OpenLayers.Strategy.Fixed()],
              protocol: new OpenLayers.Protocol.HTTP({
                url: "/kml?devices=" + escape(device.path),
                format: new OpenLayers.Format.KML({
                  extractStyles: true, 
                  extractAttributes: true,
                  maxDepth: 2
                })
              })
            })
          );
        });
        var map = new OpenLayers.Map(mapData);
        map.addControl(new OpenLayers.Control.LayerSwitcher());
        map.zoomToMaxExtent();
      }
    });

});
