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
var GUI_AOI = require('users/rayoly/SDG_APP:fnc/GUI_AOI.js');
var GUI_DATE = require('users/rayoly/SDG_APP:fnc/GUI_date.js');
var EXPORT_MAP = require('users/rayoly/SDG_APP:fnc/exportMap.js');
var GUIPREF = require('users/rayoly/SDG_APP:fnc/GUI_Prefs.js');
var LEGEND = require('users/rayoly/SDG_APP:fnc/Legend.js');
var HELP = require('users/rayoly/SDG_APP:fnc/helpBox.js');
var MODEL_WaterQual = require('users/rayoly/SDG_APP:fnc/MODEL_WaterQuality.js');
var GUI_MAP_INSPECTOR = require('users/rayoly/SDG_APP:fnc/GUI_MapInspector.js');

/************************************************************************************
 * Configure layers and locations
 ************************************************************************************/
var app = {};
//Use dataset USDOS LSIB 2017
//var COUNTRY_DATASET = ee.FeatureCollection('USDOS/LSIB/2017');
var COUNTRY_DATASET = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017');
//var country_name_key = 'COUNTRY_NA'
var country_name_key = 'country_na'
//default values
app.defaultCountry = 'Malawi';
app.defaultRegion = 'All';
app.defaultYear = '2016';
app.defaultMonth = 'All';
app.defaultAssetName = '';
app.defaultDB = 'S3_OLCI';
app.rangeType = 'Yearly';
app.waterAlgo = MODEL_WaterQual.Algorithms[1];
app.defaultParam = 'Turbidity';
//date list
app.availableYears = ['2000','2001','2002','2003','2004','2005',
  '2006','2007','2008','2009','2010',
  '2011','2012','2013','2014','2015',
  '2016','2017','2018','2019'];
app.availableMonths = ['All','01','02','03','04','05','06','07','08','09','10','11','12'];
var availableDB = MODEL_WaterQual.Instruments;
//CRS
app.EXPORT_CRS = 'EPSG:4326';
app.RegionID = 0;
/***********************************************************************************/

app.layerProperties = {
    AreaScale: 300.0, //resolution
    trendSeries: ['TSM', 'Chl-a','Turbidity','C_SPM'],
    visParam: {bands: 'Turbidity_mean', min: 0, max: 150, palette: ['001fff','2fa8ff','4affe6','9cffb6','e9ff93','fcff6b','ff9e66','ff524a','ff0000']},
    legend: {title: 'Mean Turbidity', type:'continuous'},
    defaultVisibility: true
};

// Some pre-set locations of interest that will be loaded into a pulldown menu.
var locationDict = {
  'Namibia': {lon: 18, lat: -22, zoom: 5, polygon: {}},
  'Botswana': {lon: 24, lat: -22, zoom: 5, polygon: {}}
};


/****************************************************************************************
* Internal variables and config
*****************************************************************************************/
app.defaultLocation = GUI_AOI.CountryLoc[app.defaultCountry];

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
* Extract water area
*****************************************************************************************/
var CalcWaterStats = function(Year, CountryAbbr, lMonth, lRegion, isTrend){
  //  
  var i, time_trend = true;
  var PolygonLst = ee.List([]), result = ee.List([]);
  var yearRange, monthRange, regionRange;
  var ImgWaterRegion;
  var TimeSeriesMap = ee.List([]);
  //
  if(isTrend===false){
    time_trend = true;
    yearRange = Year;
    monthRange = lMonth;
    regionRange = [GUI_AOI.regionName]; 
  }else if(app.rangeType=='Yearly'){
    //Years and months to consider
    yearRange = app.availableYears;
    monthRange = ['All'];
    regionRange = [GUI_AOI.regionName]; 
  }else{
    //Years and months to consider
    yearRange = [app.defaultYear];
    monthRange = app.availableMonths.slice(1,13);
    regionRange = [GUI_AOI.regionName]; 
  }
  //Generate list of polygons
  regionRange.forEach( function(region){
    var p = GUI_AOI.GetClippingPolygon(GUI_AOI.countryName, region, GUI_AOI.AssetName, GUI_AOI.RegionID);
    var v = ee.Dictionary({region: ee.String(region), poly:ee.Geometry(p.polygon), outline:ee.Geometry(p.outline)});
    PolygonLst = PolygonLst.add( v );
  });
  //
  print(yearRange)
  print(monthRange)
  //
  var date, DateRange,DateStart,DateEnd;
  //define reducer for image collection
  var combi_reducer = ee.Reducer.mean()
      .combine(ee.Reducer.minMax(), '', true)
      .combine(ee.Reducer.stdDev(), '', true);
  var scale = MODEL_WaterQual.WATERMEAS[app.defaultDB].scale;      
  //Loop over regions
  result = PolygonLst.map(function(Polygon){

    var poly = ee.Geometry(ee.Dictionary(Polygon).get('poly'));
    var outline = ee.Geometry(ee.Dictionary(Polygon).get('outline'));
    var region_name = ee.Dictionary(Polygon).get('region');
    var area = ee.Image.pixelArea().clip(poly);
    
    var waterMask = ee.ImageCollection('JRC/GSW1_0/YearlyHistory')
      .filterBounds(poly)
      .max()
      .gt(0.0)
      .clip(poly).selfMask();  

    //loop over years
    var res_year = ee.List(yearRange).map(function(year){
      //loop over months
      var res_month = ee.List(monthRange).map(function(month){
        //Save current time point
        date = ee.String(ee.Algorithms.If(ee.String(month).compareTo('All').eq(0),
          ee.String(year),
          ee.String(year).cat('-').cat(month)));
        
        DateRange = GUI_DATE.DateRange(year, month);
        DateStart = DateRange.get(0);
        DateEnd = DateRange.get(1);        
        //-------- Load data &  Select band to use
        var WaterQual = MODEL_WaterQual.getWaterQual(app.defaultDB, DateStart, DateEnd, poly, waterMask, app.waterAlgo);
        var waterParameters = ee.Image(WaterQual.first()).bandNames();

        WaterQual = WaterQual.reduce(combi_reducer);
        //-------- Calculate max stats
        var bands = WaterQual.bandNames();
        /*var waterStats = bands.iterate( function(band, prev_dict){
          var a = WaterQual.select([band])
                  .reduceRegion({
                    reducer: ee.Reducer.max(), 
                    geometry: poly, 
                    scale: scale,
                    maxPixels: 1e11,
                    tileScale:4
                  });
            return ee.Dictionary(prev_dict).combine(a);
          }, ee.Dictionary({}));*/
          
          var waterStats = WaterQual.reduceRegion({
              reducer: ee.Reducer.max(), 
              geometry: poly, 
              scale: scale,
              maxPixels: 1e11,
              tileScale:4
            });

        //return dictionary with all values
        return ee.Dictionary({
          //date
          date: date,
          scale:scale,
          sensor: app.defaultDB,
          DateStart:DateStart,
          DateEnd:DateEnd,
          
          //bounding area
          BoundaryPolygon: poly,
          Outline: outline,
          region: region_name,
         
          //Water mask
          waterMask: waterMask,
          
          //Air Quality
          WaterQual: WaterQual,

          //Statistics
          waterParameter: waterParameters,
          waterStats: waterStats
          
        });
      }).flatten();
      return res_month;
    }).flatten();
    return res_year;
  }).flatten();
  //
  print(result);
  return result;
};
/****************************************************************************************
* Display water layer for the selected year and region
*****************************************************************************************/
var DisplayWaterLayer = function(){
  //clear map
  ClearMap(); 
  //clear result Panel
  ClearresultPanel();
  
  //-----------------------------------------------------------------------------------
  var countryAbbr = GUI_AOI.countryCode(GUI_AOI.countryName);
  var result = CalcWaterStats([app.defaultYear], countryAbbr, [app.defaultMonth],[GUI_AOI.regionName],false);
  print(result)
  result = ee.Dictionary(result.get(0));
  /*------------------------------------------------------
  * Plots MAPS
  ------------------------------------------------------*/
  //Add region outline to map  
  mapPanel.add(ui.Map.Layer(ee.Geometry(result.get('Outline')), {}, 'Region'));
  //Add water mask
  mapPanel.addLayer( ee.Image(result.get('waterMask')), {palette:['ffffff','0000ff']}, 'Water Mask', false); 
  
  var poly = result.get('BoundaryPolygon');
  //Water quality
  var WaterQual = ee.Image(result.get('WaterQual'));
  app.layerProperties.visParam.bands = [ WaterQual.bandNames().get(0).getInfo()];
  app.layerProperties = LEGEND.setLegend(app.layerProperties, GUIPREF, 
    WaterQual.select(app.layerProperties.visParam.bands).clip(poly));

  mapPanel.addLayer( WaterQual, app.layerProperties.visParam, 'Water Quality',true); 
  
  //-Results
  var ROI;
  if(  GUI_AOI.selectedGEEAsset()===false ){
    ROI = GUI_AOI.countryName + '-' + GUI_AOI.regionName;
  }else{
    ROI = 'ShapeFile';
  }
  //Generate information text 
  //print panel
  resultPanel.style().set('shown',true);
  resultPanel.widgets().set(1, ui.Label('Computing...'));
  //
  result.evaluate(function(data, fail){
    if(typeof fail !== 'undefined'){
      HELP.show_help_panel('Error during the calculation:' + fail);
      resultPanel.style().set('shown',false);
    }else{
      //clear panel
      resultPanel.clear();
      //
      var tableData = [ ['','Min','Max','Mean','stdDev'] ];
      var water_param = data.waterParameter;
      var n = 1;
      water_param.forEach( function(water_meas) {
        tableData[n] = [  water_meas,
                          data.waterStats[water_meas+'_min'], 
                          data.waterStats[water_meas+'_max'], 
                          data.waterStats[water_meas+'_mean'], 
                          data.waterStats[water_meas+'_stdDev'] ];
        n++;
      });

      resultPanel.widgets().set(1,
        ui.Label('Statistics for ' + ROI + ' during ' + data.date + ': ', 
        {fontWeight: 'bold', color:GUIPREF.TEXTCOLOR}));    
      resultPanel.widgets().set(2, ui.Chart(tableData, 'Table', {}));
      resultPanel.style().set('height','300px');
      resultPanel.style().set('width','400px');
    }
  });
  //
};


/****************************************************************************************
* Plot water area over time period
*****************************************************************************************/
var plotTrend = function(){
  //clear map
  ClearMap(); 
  //clear result Panel
  ClearresultPanel();
  
  var result = CalcWaterStats(app.availableYears, GUI_AOI.countryCode(GUI_AOI.countryName), 
    app.availableMonths.slice(1,13), GUI_AOI.RegionLst, true);

  var areas;
  var title;
  var dataTable;
  var gif_min=1e6, gif_max=-1e6;
  //AOI: Outline
  var Outline = result.map(function(r){return ee.Geometry(ee.Dictionary(r).get('Outline'));}).flatten();
  Outline = Outline.slice(1).iterate(function(cur, prev){return ee.Geometry(prev).union(ee.Geometry(cur));},
    Outline.get(0));  
    
  var BoundaryPolygon = result.map(function(r){return ee.Geometry(ee.Dictionary(r).get('BoundaryPolygon'));}).flatten();
  BoundaryPolygon = BoundaryPolygon.slice(1).iterate(function(cur, prev){return ee.Geometry(prev).union(ee.Geometry(cur));},
    BoundaryPolygon.get(0));  

  //Add region outline to map  
  mapPanel.add(ui.Map.Layer(ee.Geometry(Outline), {}, 'Region'));

  //print info panel
  resultPanel.style().set('shown',true);
  resultPanel.widgets().set(1, ui.Label('Computing trends...'));
  //Calculate map time series for animation
  var TimeSeriesMap = result.map(function(r){
    return ee.Image(ee.Dictionary(r).get('WaterQual')).select([app.defaultParam + '_mean']).clip(ee.Geometry(BoundaryPolygon));
  });
  TimeSeriesMap = ee.ImageCollection.fromImages(TimeSeriesMap);
  var meanTimeSeries = TimeSeriesMap.mean();
  app.layerProperties = LEGEND.setLegend(app.layerProperties, GUIPREF, meanTimeSeries, BoundaryPolygon);
  //mapPanel.add(ui.Map.Layer(meanTimeSeries, app.layerProperties.visParam, app.defaultParam + '_mean (over time frame)'));
  mapPanel.add(ui.Map.Layer(TimeSeriesMap, app.layerProperties.visParam, app.defaultParam + '_mean'));
  
  //Get ROI
  var ROI;
  if(  GUI_AOI.selectedGEEAsset()===false ){
    ROI = GUI_AOI.countryName + '-' + GUI_AOI.regionName;
  }else{
    ROI = 'ShapeFile';
  }
  //
  result.evaluate( function(data){
    //Clear Panel
    resultPanel.clear();
    //Print title
    resultPanel.widgets().set(1, 
      ui.Label('Water Quality Time Series in ' + ROI,
      {fontWeight: 'bold', color:GUIPREF.TEXTCOLOR}));
    //Get water parameters
    var meas_keys = data[0].waterParameter;	

    var dates = data.map( function(d) {return d.date});
    //
    //Loop over each measurement type
    meas_keys.map( function(meas_key, n){
      dataTable = [[ 'Time', 'Mean', {id:'i0',role:'interval'}, {id:'i1',role:'interval'},{id:'d0',role:'interval'},{id:'d1',role:'interval'}]];
      data.map( function(f,i){ 
        dataTable[i+1] = [f.date];
        dataTable[i+1].push(f.waterStats[meas_key+'_mean']);
        dataTable[i+1].push(f.waterStats[meas_key+'_min']);
        dataTable[i+1].push(f.waterStats[meas_key+'_max']);
        dataTable[i+1].push(f.waterStats[meas_key+'_mean']-f.waterStats[meas_key+'_stdDev']);
        dataTable[i+1].push(f.waterStats[meas_key+'_mean']+f.waterStats[meas_key+'_stdDev']);
        n++;

        if(meas_key == app.defaultParam){
          gif_min = Math.min(gif_min, f.waterStats[meas_key+'_mean']);  
          gif_max = Math.max(gif_max, f.waterStats[meas_key+'_mean']);
        }
      });
      var waterChart = ui.Chart(dataTable)
        .setChartType('LineChart')
        //.setSeriesNames(['Min','Max','Mean'])
        .setOptions({
          title: 'Statistics for ' + meas_key + ' (Area: mean +/- std. dev, Bars: Min/Max)',
          vAxes: { 
            0: { title: MODEL_WaterQual.Units[meas_key] },
          },
          hAxis: {title: 'Time', gridlines: {count: 1}},
          interpolateNulls: true,
          intervals: { style: 'area' },
          pointSize: 1,
          lineWidth: 1,
          interval: {
            'i0': { 'style':'bars', 'barWidth':0, 'lineWidth':1, 'pointSize':1, 'fillOpacity':1 },
            'i1': { 'style':'bars', 'barWidth':0, 'lineWidth':1, 'pointSize':1, 'fillOpacity':1 },
            'd0': { 'style':'area', 'curveType':'function', 'fillOpacity':0.3 },
            'd1': { 'style':'area', 'curveType':'function', 'fillOpacity':0.3 }
          },
        });
      resultPanel.widgets().set(n+2, waterChart );
    });//end loop over gases
    
    //Show result panel
    resultPanel.style().set('shown',true);
    resultPanel.style().set('height','500px');  
    
    // Visualization and animation parameters.
    var params = {
      crs: app.EXPORT_CRS,
      framesPerSecond: 1,
      region: BoundaryPolygon,
      //bands: [app.defaultParam + '_mean'],
      min: gif_min,
      max: gif_max,
      palette: ['silver', 'white', 'orange', 'red'],
      dimensions: 512
    };
    resultPanel.widgets().set(20, ui.Thumbnail(TimeSeriesMap, params));
  });

};

/****************************************************************************************
* Plot water area over time period
*****************************************************************************************/
var exportMap = function(){
  HELP.show_help_panel('Generating Export Task for '+ app.defaultCountry + ' in ' + app.defaultYear + '.' + app.defaultMonth);

  var description = 'Water_map_for_' + app.RegionID + '_' + app.defaultYear + '-' + app.defaultMonth;
  var poly = GUI_AOI.GetClippingPolygon(GUI_AOI.countryName, GUI_AOI.regionName, GUI_AOI.AssetName, GUI_AOI.RegionID);  
  
  EXPORT_MAP.exportMap(mapPanel, description, app.layerProperties.AreaScale, poly.polygon, app.EXPORT_CRS);
};

/*=======================================================================================
                                           GUI
=======================================================================================*/
/****************************************************************************************
* Help panel 
*****************************************************************************************/
HELP.createHelpBox('This App can be used to evaluate the trend in water area and evaluate UN SDG Indicator 6.3.2', GUIPREF);

/****************************************************************************************
* GUI: Create a control panel.
*****************************************************************************************/
var header = ui.Label('SDG 6.3.2: Water Quality', GUIPREF.TITLE_STYLE);
var subheader = ui.Label(' ', GUIPREF.SUBTITLE_STYLE);
var toolPanel = ui.Panel([header, subheader], 'flow', GUIPREF.PANEL_STYLE);
toolPanel.style().set('position','top-left')
/*****************************************************************************************
* GUI: Create a map panel.
*****************************************************************************************/
//var mapPanel = ui.Map();
var mapPanel = Map.add(toolPanel);
//mapPanel.setOptions('HYBRID');
mapPanel.setControlVisibility(false,true,false);
mapPanel.add(HELP.help_panel);

// Take all tools off the map except the zoom and mapTypeControl tools.
mapPanel.setControlVisibility({all: true, zoomControl: false, mapTypeControl: true});

/****************************************************************************************
* GUI: Create a plotting/results panel.
****************************************************************************************/
var resultPanel = ui.Panel([],  'flow', 
  {border: '1px solid black', width: '300px', height: '200px', position: 'bottom-right', shown:false } );
var graphPanelTitle = ui.Label('Water Area Over Time', {fontWeight: 'bold', color:GUIPREF.TEXTCOLOR});
resultPanel.add(graphPanelTitle);


/****************************************************************************************
* Define the pulldown menu.  Changing the pulldown menu changes the displayed year
*****************************************************************************************/
//Define year, month lists
GUI_DATE.setYearList(app.availableYears);
GUI_DATE.setMonthList(app.availableMonths);
//Create GUI
GUI_DATE.createGUI(mapPanel, HELP, GUIPREF, true, true, false);
//Set Callbacks
GUI_DATE.yearSelect.onChange(function(year) {app.defaultYear=year;});
GUI_DATE.monthSelect.onChange(function(month) {
    app.defaultMonth = month;
    LEGEND.setLegend(app.layerProperties, GUIPREF);
  }
);

/****************************************************************************************
* Define the pulldown menu.  Changing the pulldown menu changes the displayed location
*****************************************************************************************/
// Create the location pulldown.
var locations = Object.keys(GUI_AOI.CountryLoc);
var index = locations.sort().indexOf(app.defaultCountry);


/******************************************************************************************
* GUI: dataset selection.
******************************************************************************************/
var DBSelect = ui.Select({
  items: availableDB,
  value: app.defaultDB,
  style: GUIPREF.SELECT_STYLE,
  onChange: function(value) {
    app.defaultDB = value;

    //Update year drop down
    GUI_DATE.yearSelect.setValue(app.availableYears[0]);
    //Update legend
    LEGEND.setLegend(app.layerProperties, GUIPREF);
  }
});    

var algorithm_lbl = ui.Label('Algorithm:', GUIPREF.LABEL_T_STYLE);
var AlgoSelect = ui.Select({
  items: MODEL_WaterQual.Algorithms,
  value: app.waterAlgo,
  style: GUIPREF.SELECT_STYLE,
  onChange: function(value) {
    app.waterAlgo = value;
  }
}); 
var AlgoPanel = ui.Panel([algorithm_lbl, AlgoSelect], 
	ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_SUBSUBPANEL_STYLE);
	
var DBPanel = ui.Panel([ui.Label('Instrument:', GUIPREF.LABEL_T_STYLE),   
  DBSelect,  AlgoPanel,
  ui.Button('?',  function() {HELP.show_help_panel(['GSW: Global Surface Water v1.0. (1984-2015) \nS3: Level 1C Sentinel-2 data used to calculate NDWI. (2015-)'
  ])}, false, GUIPREF.HELP_BTN_STYLE),
  ], 
  ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE);


/******************************************************************************************
* GUI: Selection of a predefined shape.
******************************************************************************************/
GUI_AOI.createGUI(mapPanel, HELP, GUIPREF, app.defaultCountry,app.defaultRegion);
var LocationPanel = GUI_AOI.LocationPanel;
mapPanel.centerObject(ee.Geometry(GUI_AOI.Location.polygon));
GUI_AOI.setAsset(app.defaultAssetName,  app.defaultRegionID);

/******************************************************************************************
* GUI: Inspector.
******************************************************************************************/
GUI_MAP_INSPECTOR.createGUI(mapPanel, HELP, GUIPREF, 
  ee.ImageCollection("COPERNICUS/S3/OLCI"), 'Oa02_radiance');
GUI_MAP_INSPECTOR.setTitle('Yellow substance and detrital pigments');
GUI_MAP_INSPECTOR.setvAxisTitle('turbidity');

/******************************************************************************************
* GUI: Create the legend.
******************************************************************************************/
// Define a panel for the legend and give it a tile.
GUIPREF.LEGEND_STYLE.position = 'top-right';
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
    var selected = GUI_DATE.yearSelect.getValue();
    // Loop through the layers in the mapPanel. For each layer,
    // if the layer's name is the same as the name selected in the layer
    // pulldown, set the visibility of the layer equal to the value of the
    // checkbox. Otherwise, set the visibility to false.
    mapPanel.layers().forEach(function(element, index) {
      element.setShown(selected == element.getName() ? value : false);
    });
    // If the checkbox is on, the layer pulldown should be enabled, otherwise,
    // it's disabled.
    GUI_DATE.yearSelect.setDisabled(!value);
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
  function() {HELP.show_help_panel('Update the map with the water layer calculated from the selected dataset, year and month. When Month="All", the yearly average is displayed.')},
  false, GUIPREF.HELP_BTN_STYLE);
var genMapBtn = ui.Button( 'Update Map', DisplayWaterLayer, false, GUIPREF.BUTTON_STYLE);
var mapCntrl = ui.Panel([genMapBtn, helpmap],ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
//-------------------------------------------------------------  
var rangeTypeSelect = ui.Select({
  items: ['Yearly','Monthly'],
  value: 'Yearly',
  style: GUIPREF.SELECT_STYLE,
  onChange: function(rt) {
    app.rangeType = rt;
  }
});
var helprange = ui.Button('?', 
  function() {HELP.show_help_panel('Generate a graph with the change in water quality over a time frame in years or months for the current year.'+
  '\nDisplay the extremum water quality loss and gain from the reference Year onwards.')},
  false, GUIPREF.HELP_BTN_STYLE);
var genGraphBtn = ui.Button( 'Compute Trends', plotTrend, false, GUIPREF.BUTTON_STYLE);
var graphCntrl = ui.Panel([genGraphBtn,rangeTypeSelect,helprange],  
  ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
//-------------------------------------------------------------  
var helpexp = ui.Button('?', function() {HELP.show_help_panel('Export current layers to Google Drive folder.')}, false, GUIPREF.HELP_BTN_STYLE);

var expMapBtn = ui.Button( 'Export Current Map', 
  exportMap, false, GUIPREF.BUTTON_STYLE);
var exportPanel = ui.Panel([expMapBtn, helpexp],ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
//-------------------------------------------------------------  
var trendPanel = ui.Panel([mapCntrl, graphCntrl], 
    ui.Panel.Layout.Flow('vertical'));
    
/*---------------------------------------------------------------------------------
*  Reference Panel: Source for LandSat-8 and S3 data
---------------------------------------------------------------------------------*/
// Create a hyperlink to an external reference.
var sentinel3_info = ui.Label('Copernicus/Sentinel-3 data available from 10/2016 - ',
    {backgroundColor: GUIPREF.BACKCOLOR},
    'https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S3_OLCI');
var sentinel2_info = ui.Label('Copernicus/Sentinel-2 data available from 03/2017 - ',
    {backgroundColor: GUIPREF.BACKCOLOR},
    'https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR');
var landsat_info = ui.Label('USGS Landsat 8 Surface Reflectance Tier 2 from 04/2013 - ',
    {backgroundColor: GUIPREF.BACKCOLOR},
    'https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_LC08_C01_T2_SR');	
var referencePanel = ui.Panel([ui.Label('For more information', GUIPREF.LABEL_T_STYLE), 
  sentinel3_info, 
  sentinel2_info,
  landsat_info],
  'flow', GUIPREF.CNTRL_PANEL_STYLE);

/******************************************************************************************
* GUI: Screen layout
******************************************************************************************/
//result panel

//Tool panel
toolPanel.add(ui.Panel([DBPanel, 
  GUI_DATE.datePanel, LocationPanel,
	trendPanel, exportPanel,
	GUI_MAP_INSPECTOR.InspectorControl,
	viewPanel,
	mailPanel,
	referencePanel],
	ui.Panel.Layout.flow('vertical',true)));
//map panel
mapPanel.add(resultPanel);
//overall window
//ui.root.widgets().reset([toolPanel, mapPanel]); 
