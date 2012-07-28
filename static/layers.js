 var map = new OpenLayers.Map({
     div: "map",
     allOverlays: true,
     layers: [
         new OpenLayers.Layer.OSM(),
         new OpenLayers.Layer.Google("Google Streets"),
         new OpenLayers.Layer.Vector("KML", {
             strategies: [new OpenLayers.Strategy.Fixed()],
             protocol: new OpenLayers.Protocol.HTTP({
                 url: "/kml",
                 format: new OpenLayers.Format.KML({
                     extractStyles: true, 
                     extractAttributes: true,
                     maxDepth: 2
                 })
             })
         })
     ],
 });
 map.addControl(new OpenLayers.Control.LayerSwitcher());
 map.zoomToMaxExtent();
