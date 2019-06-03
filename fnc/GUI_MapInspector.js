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

var gui = {};
/*******************************************************************************
* Create Inspector Panel that will hold the charts
********************************************************************************/
exports.createGUI = function(mapPanel, HELP, GUIPREF, collection, band){
  gui.mapPanel = mapPanel;
  gui.collection = collection.select(band);

  gui.vAxisTitle = 'Something';
  gui.Title = 'Time Series';  
  gui.callbackID = null;
  //create gui
	gui.ck_inspect = ui.Checkbox({
    label: 'Inspect',
    value: false,
    style: GUIPREF.CKBOX_STYLE,
    onChange: function(value) { }
  });
	exports.InspectorControl = ui.Panel([gui.ck_inspect], 
	ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
	//
	var help_quit = ui.Button({label: 'X',style: {position: 'top-right', color: 'red', backgroundColor: GUIPREF.BACKCOLOR}});
  var help_text = ui.Label({
    value: 'Time Series',
    style: {position: 'top-left', margin:'10px 4px 4px 4px', padding:'0px', 
    width: '330px', whiteSpace: 'pre-wrap', color:'#44546A', 
    backgroundColor: GUIPREF.BACKCOLOR}});	
	//
	gui.InpsectorPanel = ui.Panel({
		layout: ui.Panel.Layout.absolute(),
		widgets: [help_quit, help_text],
		style: {shown:false,width: '500px', height: '150px', color:GUIPREF.TEXTCOLOR, backgroundColor: GUIPREF.BACKCOLOR}
	});
	help_quit.onClick( function() {gui.InpsectorPanel.style().set('shown', false); });
	mapPanel.add(gui.InpsectorPanel);
	//
  gui.ck_inspect.onChange(function(value) {
    gui.InpsectorPanel.style().set('shown',value);
    if(value){
      //register
      gui.callbackID = mapPanel.onClick(generateChart);
      mapPanel.style().set('cursor', 'crosshair');
    }else{
      //un-register
      mapPanel.unlisten( gui.callbackID );
      mapPanel.style().set('cursor', 'hand');
    }
  });
}
/*******************************************************************************
*
*******************************************************************************/
exports.setTitle = function(t){
	gui.title = t;
}
/*******************************************************************************
*
*******************************************************************************/
exports.setvAxisTitle = function(t){
	gui.vAxisTitle = t;
}
/*******************************************************************************
*
*******************************************************************************/
exports.setCollection = function(c){
	gui.collection = c;
}
/*******************************************************************************
*
*******************************************************************************/
var generateChart = function (coords) {
	// Update the lon/lat panel with values from the click event.
	var lon = ui.Label('lon: ' + coords.lon.toFixed(2));
	var lat = ui.Label('lat: ' + coords.lat.toFixed(2));

	// Add a dot for the point clicked on.
	var point = ee.Geometry.Point(coords.lon, coords.lat);
	var dot = ui.Map.Layer(point, {color: '000000'}, 'clicked location');
	// Add the dot as the second layer, so it shows up on top of the composite.
	gui.mapPanel.layers().set(1, dot);
	
	// Make a chart from the time series.
	var collectionChart = ui.Chart.image.series(gui.collection, point, ee.Reducer.mean(), 500);
	
	// Customize the chart.
	collectionChart.setOptions({
		title: gui.title,
		vAxis: {title: gui.vAxisTitle},
		hAxis: {title: 'Date', format: 'MM-yy', gridlines: {count: 7}},
		series: {
			0: {
				color: 'blue',
				lineWidth: 0,
				pointsVisible: true,
				pointSize: 2,
				},
		},
		legend: {position: 'right'},
	});
	// Add the chart at a fixed position, so that new charts overwrite older ones.
	gui.InpsectorPanel.widgets().set(2, lon);
	gui.InpsectorPanel.widgets().set(3, lat);
	gui.InpsectorPanel.widgets().set(4, collectionChart);
	gui.InpsectorPanel.style().set('shown',true);
};
