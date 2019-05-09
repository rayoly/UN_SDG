/****************************************************************************************
*  
*****************************************************************************************/
exports.exportMap = function(mapPanel, description, scale, poly, export_crs){
  
  var layername = '';
  var image;
  var layer;
  var n;
  
  for(n=0; n<mapPanel.layers().length(); n++){
    
    layer = mapPanel.layers().get(n);
    image = layer.get('eeObject');
    layername = layer.get('name');
  
    Export.image.toDrive({
        image: image,
        description: description + '_' + layername,
        scale: scale,
        region: poly,
        maxPixels: 1e10,
        skipEmptyTiles: false,
        crs: export_crs,
        fileFormat: 'GeoTIFF'
        });
  }
}
