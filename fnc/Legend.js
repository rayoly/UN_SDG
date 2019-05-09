
/******************************************************************************************
* GUI: Create the legend.
******************************************************************************************/
exports.createLegend = function(mapPanel, GUIPREF){
  // Define a panel for the legend and give it a tile.
  var legendPanel = ui.Panel({style: GUIPREF.LEGEND_STYLE});
  mapPanel.add(legendPanel);

  var legendTitle = ui.Label('Legend',  GUIPREF.LEGEND_TITLE_STYLE);
  legendPanel.add(legendTitle);

  // Define an area for the legend key itself.
  // This area will be replaced every time the layer pulldown is changed.
  exports.keyPanel = ui.Panel({style: {backgroundColor:GUIPREF.BACKCOLOR}});
  legendPanel.add(exports.keyPanel);
  
}

/******************************************************************************************
 * Set legend function
*******************************************************************************************/
exports.setLegend = function(layer, GUIPREF) {
  // Loop through all the items in a layer's key property,
  // creates the item, and adds it to the key panel.
  exports.keyPanel.clear();
  
  if(layer.legend.type=='discrete'){
    for (var i = 0; i < layer.legend.style.length; i++) {
      var item = layer.legend.style[i];
      var name = Object.keys(item)[0];
      var color = item[name];
      var colorBox = ui.Label('', {
        backgroundColor: color,
        // Use padding to give the box height and width.
        padding: '8px',
        margin: '0'
      });
      // Create the label with the description text.
      exports.keyPanel.add(
          ui.Panel([colorBox, ui.Label(name, GUIPREF.LEGEND_TEXT_STYLE)], ui.Panel.Layout.Flow('horizontal')),{});
    }
  }else{
    // Create the color bar for the legend.
    var colorBar = ui.Thumbnail({
      image: ee.Image.pixelLonLat().select(0),
      params: {
        bbox: [0, 0, layer.visParam.max-layer.visParam.min, 0.1],
        dimensions: '50x10',
        format: 'png',
        min: layer.visParam.min,
        max: layer.visParam.max,
        palette: layer.visParam.palette
      },
      style: {stretch: 'horizontal', margin: '0', maxHeight: '8px'},
    });
    //title
    if(typeof layer.legend.title !== "undefined"){
      exports.keyPanel.add(
        ui.Panel([ui.Label(layer.legend.title, GUIPREF.LEGEND_TEXT_STYLE)]));
    }
    //colorbar
    exports.keyPanel.add(
      ui.Panel([
        ui.Label(layer.visParam.min, GUIPREF.LEGEND_TEXT_STYLE), 
        colorBar, 
        ui.Label(layer.visParam.max, GUIPREF.LEGEND_TEXT_STYLE)], 
      ui.Panel.Layout.Flow('horizontal'), {}));
  }
}

/******************************************************************************************
 * Set scale
*******************************************************************************************/
exports.createScale = function(){

var visParam = {min:0, margin:0, padding:0, max:1, palete: ['black','white']};

var unit_distance = 5; //unit in km
var cur_scale = (Map.getScale()/1000.0);//scale in km

var lon = ee.Image.pixelLonLat().select('longitude'); //longitude in arc degrees
var lat = ee.Image.pixelLonLat().select('latitude'); //latitude in arc degrees
var length_lon1deg = lat.multiply(3.1415/180).cos().multiply(111.0);
var scale = (lon.multiply(length_lon1deg)).multiply(3.1415/unit_distance).sin().gt(0);


var colorBar = ui.Thumbnail({
  image: scale,
  params: {
	bbox: [0, 0, 10, 0.1],
	dimensions: '100x10',
	format: 'png',
	min: visParam.min,
	max: visParam.max,
	palette: visParam.palette
  },
  style: {stretch: 'horizontal', border:'1px solid black', 
	margin: '0', padding:'0', maxHeight: '12px'},
});
var panel = ui.Panel([ui.Label(0, {}), colorBar,  ui.Label(unit_distance, {})],
  ui.Panel.Layout.Flow('horizontal'),{});
 
            
}