/*
MIT License

Copyright (c) 2019 Raymond Olympio, rayoly@gmail.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
/*----------------------------------------------------------------------------------------
This script generate a legend on the  Map based on input parameters.
The legend can be discrete or continuous.
The plotting of a legend is updated by calling "setLegend" with the layer definition.
The layer definition must include the legend's type and visualization parameters:
  .type: 'discrete' or 'continuous'
  .style: visualization parameters
-----------------------------------------------------------------------------------------*/

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
