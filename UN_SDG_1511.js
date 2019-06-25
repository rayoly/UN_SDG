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
var CONFIG = require('users/rayoly/SDG_APP:config.js');
var AVG = require('users/rayoly/SDG_APP:fnc/Average_fnc.js');
var EXPORT_MAP = require('users/rayoly/SDG_APP:fnc/exportMap.js');
var GUIPREF = require('users/rayoly/SDG_APP:fnc/GUI_Prefs.js');
var LEGEND = require('users/rayoly/SDG_APP:fnc/Legend.js');
var HELP = require('users/rayoly/SDG_APP:fnc/helpBox.js');
var GUI_AOI = require('users/rayoly/SDG_APP:fnc/GUI_AOI.js');
var GUI_DATE = require('users/rayoly/SDG_APP:fnc/GUI_date.js');
var MODEL_FOREST = require('users/rayoly/SDG_APP:fnc/MODEL_Forest.js');

/************************************************************************************
 * Configure layers and locations
 ************************************************************************************/
//Use dataset USDOS LSIB 2017
var COUNTRY_DATASET = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017');
var app = {};

//default values
app.defaultCountry = 'Namibia';
app.defaultRegion = 'All';
app.defaultYear = '2002';
app.defaultAssetName = '';
app.defaultDB = 'MODIS';
app.defaultIndice = 'EVI';
app.EVI_min = 0.2;
app.EVI_max = 0.8;
//date list
app.availableDB = ['MODIS','S2'];
//CRS
app.EXPORT_CRS = 'EPSG:4326';
app.RegionID = 0;
/***********************************************************************************/
var EVI_visParam = {min:-1, max:1, palette:['ffffff', 'ff0000', 'ffff00', '00ffff', '0000ff']};
var NDVI_visParam = {
  min:-1, max:1,
  palette: [
    'FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718', '74A901',
    '66A000', '529400', '3E8601', '207401', '056201', '004C00', '023B01',
    '012E01', '011D01', '011301'
  ],
};
var TimeSeriesParam = {
  name: 'Statistics',
  visParam: {bands: ['forest_change'], min:-1, max:1, palette:['ff0000','000000','0000ff']},
  legend: {type:'discrete', name: 'Change', style:[{'Loss':'red'},{'Unchanged':'black'},{'Gain':'blue'}]}  
};

var layerProperties = {
  'MODIS':{
      band: 'EVI',
      AreaScale: 1000.0, //resolution
      availableYears: Array.apply(null, {length: 18}).map( function(number, index){return (2002+index).toString()}),
      trendSeries: ['Area','Change'],
      visParams: {min: -1, max: 1, palette: ['red', 'white', 'green']},
      legend: {type:'discrete', style:[ {'Forest': 'green'}, {'No Forest':'white'} ]},
  },
  'S2':{
      band: 'EVI',
      availableYears: Array.apply(null, {length: 4}).map( function(number, index){return (2015+index).toString()}),
      AreaScale: 20.0, //resolution
      trendSeries: ['Area', 'Change'],
      visParams: {min: -1, max: 1, palette: ['red', 'white', 'green']},
      legend: {type:'discrete', style:[ {'Forest': 'green'}, {'No Forest': 'white'} ]},
  }
};
app.defaultLayer = layerProperties[app.defaultDB];
var FOREST_DATASET;
app.defaultLocation = GUI_AOI.CountryLoc[app.defaultCountry];
/****************************************************************************************
* Help panel 
*****************************************************************************************/
HELP.createHelpBox('This App can be used to evaluate the trend in forest area and evaluate UN SDG Indicator 15.1.1', GUIPREF);
MODEL_FOREST.set_EVI_Threshold(app.EVI_min, app.EVI_max);
GUI_DATE.YearList = app.defaultLayer.availableYears;
/*=======================================================================================
                                           FUNCTIONS
=======================================================================================*/

/****************************************************************************************
* Clear map panel
*****************************************************************************************/
function ClearMap(array){
  while(mapPanel.layers().length()>0){
    mapPanel.remove(mapPanel.layers().get(0));
  }
}
/****************************************************************************************
* Clear result panel
*****************************************************************************************/
var ClearresultPanel = function(){
  while(resultPanel.widgets().length()>0){
    resultPanel.remove(resultPanel.widgets().get(0));
  }
}

/****************************************************************************************
* Extract forest area
*****************************************************************************************/
var forestCount = function(image, geometry, AreaScale){

  var area = ee.Image.pixelArea();
  var forestArea = ee.Image(image.select('forest'))
                    .multiply(area)
                    .rename('forestArea');
  
  var stats = forestArea.reduceRegion({
      reducer: ee.Reducer.sum(), 
      geometry: geometry, 
      scale: AreaScale,
      //bestEffort: true,
      maxPixels: 1e11
    });
    
  var StrArea = stats.get('forestArea');
  return StrArea;
};

/****************************************************************************************
* Extract forest area
*****************************************************************************************/
var CalcForestArea = function(){
    //Output data
    var data = {date: [], area: [], pctchange:[]}; 
    //    
    var i;
    var DateStart, DateEnd, yearRange;
    var ImgForestRegion;
    var TimeSeriesMap = ee.List([]);
    //
    var poly = GUI_AOI.GetClippingPolygon(GUI_AOI.countryName, GUI_AOI.regionName, 
      GUI_AOI.AssetName, GUI_AOI.RegionID);
    //
    //define layer to use
    app.defaultLayer = layerProperties[app.defaultDB];
    yearRange = app.defaultLayer.availableYears;
    //LOOP
    var result = ee.List(yearRange).map(function(year){
      //-------- Load data &  Select band to use
      ImgForestRegion = ee.Image(ee.Algorithms.If(ee.String(app.defaultDB).compareTo('MODIS').eq(0),
        MODEL_FOREST.MODIS(year, poly),
        MODEL_FOREST.S2(app.defaultIndice, year, poly)));
      //----------------------------------------------------------------------------------------
      var area = ee.Number(forestCount(ImgForestRegion, poly.polygon, app.defaultLayer.AreaScale)).divide(1e6);
      //
      return ee.Dictionary({
        Map: ImgForestRegion.select([app.defaultIndice,'forest']), 
        Outline: poly.outline,
        Polygon: poly.polygon,
        area:area, 
        date: year});
    });
    //
    return result;
}

/****************************************************************************************
* Display forest layer for the selected year and region
*****************************************************************************************/
var DisplayForestLayer = function(){
  //Update legend
  LEGEND.setLegend(app.defaultLayer, GUIPREF);

  //Define region outline
  var poly = GUI_AOI.GetClippingPolygon(GUI_AOI.countryName, GUI_AOI.regionName, GUI_AOI.AssetName, 
      GUI_AOI.RegionID);
  
  //Generate forest layer(s) based on Global surface forest dataset or S2 data
  var ImgForestRegion;
  if(app.defaultDB=='MODIS'){
    ImgForestRegion = MODEL_FOREST.MODIS(app.defaultYear, poly);
  }else{
    ImgForestRegion = MODEL_FOREST.S2(app.defaultDB, app.defaultYear, poly);
  }
  //Clear Map
  ClearMap();
  //Clear Result Panel
  ClearresultPanel();
  
  //plot outline
  mapPanel.add(ui.Map.Layer(poly.outline, {}, 'Region'));
  
  //plot forest layer
  mapPanel.add(ui.Map.Layer(ImgForestRegion.select(app.defaultLayer.band), 
    app.defaultLayer.visParams, 
    'EVI_' + app.defaultYear, 
    app.defaultLayer.defaultVisibility));
  
  //plot everything
  mapPanel.add(ui.Map.Layer(ImgForestRegion,{},'All',false));
    
  //Calculate total country area
  var stats = ee.Image.pixelArea().rename('area').reduceRegion({
      reducer: ee.Reducer.sum(), 
      geometry: poly.polygon, 
      scale: app.defaultLayer.AreaScale,
      maxPixels: 1e11
    });
  var cntarea = ee.Number(stats.get('area')).divide(1e6);

  //Calculate forest extent
  var area = ee.Number(0);
  var ForestInfo, infotxt;
  area = ee.Number(forestCount(ImgForestRegion, poly.polygon, app.defaultLayer.AreaScale)).divide(1e6);

  infotxt = ee.String('Extent of forest during ' + app.defaultYear + '[' + app.defaultDB + ']:\n*Area=')
        .cat(area.format('%.2f km^2 ('))
        .cat(area.multiply(100).divide(cntarea).format('%.2f'))
        .cat(ee.String('% coverage)'));  

  ForestInfo = ui.Label(infotxt.getInfo(),  {fontWeight: 'bold', color:GUIPREF.TEXTCOLOR});

  resultPanel.widgets().set(1, ForestInfo);
  resultPanel.widgets().remove( resultPanel.widgets().get(2) );
  resultPanel.style().set('shown',true);
  resultPanel.style().set('height','120px');
}

/****************************************************************************************
* Plot forest area over time period
*****************************************************************************************/
var plotTrend = function(){
  //Clear Map
  ClearMap();
  //Clear Result Panel
  ClearresultPanel();
  //
  var result = CalcForestArea();
  var areas, title, area;
  //plot outline
  mapPanel.add(ui.Map.Layer(ee.Geometry( ee.Dictionary(result.get(0)).get('Outline')), {}, 'Region'));
  //Animation		
  var TimeSeriesMap = ee.ImageCollection.fromImages(result.map(function(r){return ee.Dictionary(r).get('Map');}));
  //forest mask
  var forest_mask = TimeSeriesMap
    .map(function(f) {return f.select('forest').unmask(0)})
    .sum().gt(0.0)
    .rename('forest_mask');

  //apply forest mask
  TimeSeriesMap = TimeSeriesMap
    .map(function(f) {return f.unmask(0).updateMask(forest_mask)});

  //Update info panel
  resultPanel.widgets().set(1, ui.Label('Calculating Time Series...'));
  resultPanel.style().set('shown',true);
  //
  result.evaluate( function(data, fail){
    //clear result Panel
    ClearresultPanel();
    if(typeof fail !== 'undefined'){
      HELP.show_help_panel('Error during the time series calculation:' + fail);
    }else{
      //5-year average
      area = data.map(function(d){return d.area});
      var pctchange=[];
      var gamma2;
      var beta2 = AVG.Average5( area , 2001-1984);      
      for(var i=0;i<area.length;i++){
        gamma2 = AVG.Average5(area,i);
        pctchange.push( (beta2-gamma2)/beta2*100 );
      }
      
      areas = [area, pctchange];
      //Print title
      if(app.defaultAssetName.length===0){
        title = 'Forest Area Over Time over ' + app.defaultCountry + '.' + app.defaultRegion +
          ' during '+ app.defaultYear;
      }else{
        title = 'Forest Area Over Time over ' + app.defaultAssetName + '.' + app.RegionID + 
          ' during '+ app.defaultYear;
      }
      var time_range = data.map(function(f){return f.date});
      
      var forestChart = ui.Chart.array.values(areas, 1, time_range)
        .setChartType('LineChart')
        .setSeriesNames(app.defaultLayer.trendSeries)
        .setOptions({
          title: title,
          vAxes: {
          0: { title: 'Area [km2]' },
          1: {
            title: '% Area Change (Ref: 2001-2005)',
            baselineColor: 'transparent'}
          },
          hAxis: {title: 'Year', gridlines: {count: 1}},
          interpolateNulls: true,
          pointSize: 1,
          lineWidth: 1,
          series: {
            0: {targetAxisIndex: 0},
            1: {targetAxisIndex: 1}
          }        
        });
      //Create summary panel
      var Info = ui.Label('Forest statistics during ' + app.defaultYear );
      resultPanel.widgets().set(1, Info);  
      resultPanel.widgets().set(2, forestChart);
      resultPanel.style().set('shown',true);
      resultPanel.style().set('height','400px');
      // Visualization and animation parameters.
      var params = {
        crs: 'EPSG:3857',
        framesPerSecond: 1,
        region: data[0].Polygon,
        bands: ['forest'],
        min: 0.0,
        max: 1.0,
        palette: ['silver', 'white', 'green', 'darkgreen'],
        dimensions: 512
      };
      resultPanel.widgets().set(3, ui.Thumbnail(TimeSeriesMap, params));
    
      var LE = ee.Number( time_range.length );
      //Calculate time series
      var combi_reducer = ee.Reducer.mean()
        .combine(ee.Reducer.minMax(), '', true)
        .combine(ee.Reducer.variance(), '', true)
        .combine(ee.Reducer.stdDev(), '', true)
        .combine(ee.Reducer.percentile([0,25,50,75,99]), '', true)
        .combine(ee.Reducer.count(), '', true);

      var timeseriesmap = TimeSeriesMap
        .reduce(combi_reducer)
        .selfMask();

      //add permanent
      timeseriesmap = timeseriesmap.addBands(
        (timeseriesmap.select('forest_count').eq(LE)).gt(0.0)
        .updateMask(forest_mask)
        .rename('forest_permanent')	);

      //add forest change band
      var forest_reference,forest_exam_range;
      var forest_loss, forest_gain;
      //define reference forest level
      forest_reference = TimeSeriesMap
        .select('forest')
        .filterMetadata('year', 'equals',parseInt(app.defaultYear)).first();
      //
      forest_exam_range = TimeSeriesMap
        .select('forest')
        .filterMetadata('year', 'greater_than',parseInt(app.defaultYear));
      //gain
      forest_gain = forest_exam_range
        .map(function(img) {return img.subtract(forest_reference)})
        .max().gt(0).rename('forest_gain');
      //loss
      forest_loss = forest_exam_range
        .map(function(img) {return img.subtract(forest_reference)})
        .min().lt(0).multiply(-1.0).rename('forest_loss');
        
      var forest_change = forest_gain.add(forest_loss).rename('forest_change');
      
      timeseriesmap = timeseriesmap.addBands( forest_mask.updateMask(forest_mask.neq(0)) );
      timeseriesmap = timeseriesmap.addBands( forest_loss.updateMask(forest_loss.neq(0)) );
      timeseriesmap = timeseriesmap.addBands( forest_gain.updateMask(forest_gain.neq(0)) );
      timeseriesmap = timeseriesmap.addBands( forest_change );
      //Update legend
      LEGEND.setLegend(TimeSeriesParam, GUIPREF);
  
      mapPanel.add(ui.Map.Layer(timeseriesmap, TimeSeriesParam.visParam, TimeSeriesParam.name,true));
      mapPanel.add(ui.Map.Layer(TimeSeriesMap, {}, 'Time Series',false));
    }//end if...else
  });//
};

/****************************************************************************************
* Plot forest area over time period
*****************************************************************************************/
var exportMap = function(){
  HELP.show_help_panel('Generating Export Task for '+ app.defaultCountry + ' in ' + app.defaultYear )
  
  var description = 'forest_map_for_' + app.RegionID + '_' + app.defaultYear;
  var poly = GUI_AOI.GetClippingPolygon(GUI_AOI.countryName, GUI_AOI.regionName, 
    GUI_AOI.AssetName, GUI_AOI.RegionID);
  
  EXPORT_MAP.exportMap(mapPanel, description, app.defaultLayer.AreaScale, poly.polygon, EXPORT_CRS)
}

/*=======================================================================================
                                           GUI
=======================================================================================*/

/*****************************************************************************************
 * Map panel configuration
 *****************************************************************************************/
ui.root.setLayout(ui.Panel.Layout.flow('horizontal'));

/****************************************************************************************
* GUI: Create a control panel.
*****************************************************************************************/
var header = ui.Label('SDG 15.1.1: Forest Area Change', GUIPREF.TITLE_STYLE);
var subheader = ui.Label(' ', GUIPREF.SUBTITLE_STYLE);
var toolPanel = ui.Panel([header, subheader], 'flow', GUIPREF.PANEL_STYLE);
toolPanel.style().set('position','top-left');

/*****************************************************************************************
* GUI: Create a map panel.
*****************************************************************************************/
var mapPanel = ui.Map();
//var mapPanel = Map.add(toolPanel);
//mapPanel.setOptions('HYBRID');

mapPanel.add(HELP.help_panel);
// Take all tools off the map except the zoom and mapTypeControl tools.
mapPanel.setControlVisibility({all: false, layerList:true, zoomControl: false, mapTypeControl: true});

mapPanel.centerObject( ee.Geometry(app.defaultLocation.polygon) );

/****************************************************************************************
* GUI: Create a plotting/results panel.
****************************************************************************************/
var resultPanel = ui.Panel([],  'flow', 
  {border: '1px solid black', width: '300px', height: '200px', position: 'bottom-right', shown:false } );
resultPanel.add(ui.Label('Forest Area Over Time', {fontWeight: 'bold', color:GUIPREF.TEXTCOLOR}))

/****************************************************************************************
* Define the pulldown menu.  Changing the pulldown menu changes the displayed year
*****************************************************************************************/
var yearSelect = ui.Select({
  items: Array.apply(null, {length: 19}).map( function(number, index){return (2000+index).toString()}),
  value: app.defaultLayer.availableYears[1],
  style: GUIPREF.SELECT_STYLE,
  onChange: function(year) {
    app.defaultYear = year;
  }
});

// Add the select to the toolPanel with some explanatory text.
var yearPanel = ui.Panel([
  ui.Label( 'Reference Year:', GUIPREF.LABEL_T_STYLE), 
  yearSelect],
  ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE);
yearSelect.setValue(app.defaultLayer.availableYears[0]);

/******************************************************************************************
* GUI: Selection of a predefined shape.
******************************************************************************************/
GUI_AOI.createGUI(mapPanel, HELP, GUIPREF, app.defaultCountry, app.defaultRegion, false);
var LocationPanel = GUI_AOI.LocationPanel;
mapPanel.centerObject(ee.Geometry(GUI_AOI.Location.polygon));
GUI_AOI.setAsset(app.defaultAssetName,  app.defaultRegionID);

/******************************************************************************************
* GUI: dataset selection.
******************************************************************************************/
var DBSelect = ui.Select({
  items: app.availableDB,
  value: app.defaultDB,
  style: GUIPREF.SELECT_STYLE,
  onChange: function(value) {
    app.defaultDB = value;
    //clear map
    ClearMap(); 
    //clear result Panel
    ClearresultPanel();    
    //update layer prop
    app.defaultLayer = layerProperties[app.defaultDB];
    //Update year drop down
    yearSelect.setValue(app.defaultLayer.availableYears[0]);
    //Update legend
    LEGEND.setLegend(app.defaultLayer, GUIPREF);
  }
});    
var IndiceSelect = ui.Select({
  items: ['EVI','NDVI'],
  value: app.defaultIndice,
  style: GUIPREF.SELECT_STYLE,
  onChange: function(value) {
    app.defaultIndice = value;
  }
});    
GUIPREF.EDIT_STYLE.width = '50px';
var evi_min_textbox = ui.Textbox({
  value: app.EVI_min,
  placeholder: 'EVI min',
  style: GUIPREF.EDIT_STYLE,
  onChange: function(text) {
    app.EVI_min = Number(text);
    MODEL_FOREST.set_EVI_Threshold(app.EVI_min, app.EVI_max);
    HELP.show_help_panel('EVI Min ' + app.EVI_min );
  }
});
var evi_max_textbox = ui.Textbox({
  value: app.EVI_max,
  placeholder: 'EVI max',
  style: GUIPREF.EDIT_STYLE,
  onChange: function(text) {
    app.EVI_max = Number(text);
    MODEL_FOREST.set_EVI_Threshold(app.EVI_min, app.EVI_max);
    HELP.show_help_panel('EVI Max ' + app.EVI_max );
  }
});

var DBPanel = ui.Panel([ui.Label('Dataset:', GUIPREF.LABEL_T_STYLE),   DBSelect,
  
  ui.Button('?',  function() {HELP.show_help_panel(['MODIS: MOD13A2.006 Terra Vegetation Indices(2000-) \nS2: Level 1C Sentinel-2 data used to calculate EVI. (2015-)'])}, false, GUIPREF.HELP_BTN_STYLE)], 
  ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE);

var IndicePanel = ui.Panel([ui.Label('Index:', GUIPREF.LABEL_T_STYLE),   IndiceSelect,
  evi_min_textbox,evi_max_textbox,
  ui.Button('?',  function() {HELP.show_help_panel(['EVI: Enhanced Vegetation Index. Range: 0.2-0.8.\nNDVI: Normalized Difference Vegetation Index.'])}, false, GUIPREF.HELP_BTN_STYLE)], 
  ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE);


/******************************************************************************************
* GUI: Create the legend.
******************************************************************************************/
// Define a panel for the legend and give it a tile.
//GUIPREF.LEGEND_STYLE.position = 'top-right';
LEGEND.createLegend(mapPanel, GUIPREF);

/******************************************************************************************
// Create a visibility checkbox and an opacity slider.
******************************************************************************************/
// If the checkbox is clicked off, disable the layer pulldown and turn all the
// layers off. Otherwise, enable the select, and turn on the selected layer.
var checkbox = ui.Checkbox({
  label: 'Layer Opacity',
  value: true,
  style: GUIPREF.CKBOX_STYLE,
  onChange: function(value) {
    var selected = yearSelect.getValue();
    // Loop through the layers in the mapPanel. For each layer,
    // if the layer's name is the same as the name selected in the layer
    // pulldown, set the visibility of the layer equal to the value of the
    // checkbox. Otherwise, set the visibility to false.
    mapPanel.layers().forEach(function(element, index) {
      element.setShown(selected == element.getName() ? value : false);
    });
    // If the checkbox is on, the layer pulldown should be enabled, otherwise,
    // it's disabled.
    yearSelect.setDisabled(!value);
  }
});

// Create an opacity slider. This tool will change the opacity for each layer.
// That way switching to a new layer will maintain the chosen opacity.
var opacitySlider = ui.Slider({  min: 0,  max: 1,  value: 1,  step: 0.01,  style: GUIPREF.SLIDER_STYLE});
opacitySlider.onSlide(function(value) {
  mapPanel.layers().forEach(function(element, index) {
    element.setOpacity(value);
  });
});
var mailPanel = ui.Panel([ui.Label('Raymond Olympio, 2019', {backgroundColor: GUIPREF.BACKCOLOR}, 'mailto:rayoly@gmail.com')], 
  ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
var viewPanel = ui.Panel([checkbox, opacitySlider], ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
//-------------------------------------------------------------
var helpmap = ui.Button('?',
  function() {HELP.show_help_panel('Update the map with the forest layer calculated from the selected dataset, year.')},
  false, GUIPREF.HELP_BTN_STYLE);
var genMapBtn = ui.Button( 'Update Map', DisplayForestLayer, false, GUIPREF.BUTTON_STYLE);
var mapCntrl = ui.Panel([genMapBtn, helpmap],ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
//-------------------------------------------------------------  
var helprange = ui.Button('?', 
  function() {HELP.show_help_panel('Generate a graph with the change in forest area over a time frame in years')},
  false, GUIPREF.HELP_BTN_STYLE);
var genGraphBtn = ui.Button( 'Generate Trend Graph', plotTrend, false, GUIPREF.BUTTON_STYLE);
var graphCntrl = ui.Panel([genGraphBtn,helprange],  ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
//-------------------------------------------------------------  
var helpexp = ui.Button('?', function() {HELP.show_help_panel('Export current layers to Google Drive folder.')}, false, GUIPREF.HELP_BTN_STYLE);
var expMapBtn = ui.Button( 'Export Current Map', exportMap, false, GUIPREF.BUTTON_STYLE);
var exportPanel = ui.Panel([expMapBtn, helpexp],ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
//-------------------------------------------------------------  
var trendPanel = ui.Panel([mapCntrl, graphCntrl], ui.Panel.Layout.Flow('vertical'));
    
/*---------------------------------------------------------------------------------
*  Reference Panel: Source for MODIS and S2 data
---------------------------------------------------------------------------------*/
// Create a hyperlink to an external reference.
var gbcgee_info = ui.Label(
    'Global Forest Change App from GEE', 
    {backgroundColor: GUIPREF.BACKCOLOR},
    'https://google.earthengine.app/view/forest-change');
var modis_info = ui.Label(
    'MODIS dataset', 
    {backgroundColor: GUIPREF.BACKCOLOR},
    'https://doi.org/10.5067/MODIS/MOD13A2.006');
var sentinel_info = ui.Label('Copernicus/Sentinel-2 data available from Jun 23, 2015 - ',
    {backgroundColor: GUIPREF.BACKCOLOR},
    'http://');
var gfw_info = ui.Label('Global Forest Watch',
    {backgroundColor: GUIPREF.BACKCOLOR},
    'https://www.globalforestwatch.org');    
var referencePanel = ui.Panel([ui.Label('For more information', GUIPREF.LABEL_T_STYLE), 
  gbcgee_info, gfw_info, modis_info, sentinel_info],'flow', GUIPREF.CNTRL_PANEL_STYLE);

/******************************************************************************************
* GUI: Screen layout
******************************************************************************************/
//result panel

//Tool panel
toolPanel.add(ui.Panel([DBPanel, IndicePanel, yearPanel, LocationPanel,
	trendPanel, exportPanel, viewPanel,
	mailPanel,
	referencePanel],
	ui.Panel.Layout.flow('vertical',true)));
//map panel
mapPanel.add(resultPanel);
//overall window
ui.root.widgets().reset([toolPanel, mapPanel]); 
