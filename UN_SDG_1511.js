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

var AVG = require('users/rayoly/SDG_APP:fnc/Average_fnc.js');
var AdministrativeRegions = require('users/rayoly/SDG_APP:fnc/AdministrativeRegions_fnc.js');
var GUIPREF = require('users/rayoly/SDG_APP:fnc/GUI_Prefs.js');

/************************************************************************************
 * Configure layers and locations
 ************************************************************************************/
//Use dataset USDOS LSIB 2017
//var COUNTRY_DATASET = ee.FeatureCollection('USDOS/LSIB/2017');
var COUNTRY_DATASET = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017');
//var country_name_key = 'COUNTRY_NA'
var country_name_key = 'country_na'
//default values
var defaultCountry = 'Namibia';
var defaultRegion = 'All';
var defaultYear = '2002';
var defaultAssetName = '';
var defaultDB = 'MODIS';
var defaultIndice = 'EVI';
var EVI_min = 0.2;
var EVI_max = 0.8;
//date list
var availableDB = ['MODIS','S2'];
//CRS
var EXPORT_CRS = 'EPSG:4326';
var RegionID = 0;
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
  //visParam: {bands: ["water_loss","water_permanent","water_gain"], min:0, max:1},
  //legend: {type:'discrete', name: 'percentile', style:[ {'Loss': 'red'}, {'Permanent': 'green'}, {'Gain': 'blue'} ]}  
  //visParam: {bands: ['water_mean'], min:0, max:1, palette:['0000ff','ff0000']},
  //legend: {type:'continuous', name: 'variance'}
  visParam: {bands: ['forest_change'], min:-1, max:1, palette:['ff0000','000000','0000ff']},
  legend: {type:'discrete', name: 'Change', style:[{'Loss':'red'},{'Unchanged':'black'},{'Gain':'blue'}]}  
};

var layerProperties = {
  'MODIS':{
      band: 'EVI',
      DATASET_name: 'MODIS/006/MOD13A2', //dataset: MODIS Terra Daily EVI
      AreaScale: 1000.0, //resolution
      availableYears: Array.apply(null, {length: 18}).map( function(number, index){return (2002+index).toString()}),
      trendSeries: ['Area','Change'],
      visParams: {min: -1, max: 1, palette: ['red', 'white', 'green']},
      legend: [ {'Forest': 'green'}, {'No Forest':'white'} ],
  },
  'S2':{
      band: 'EVI',
      availableYears: Array.apply(null, {length: 4}).map( function(number, index){return (2015+index).toString()}),
      DATASET_name: 'COPERNICUS/S2', //dataset, L1C: 'COPERNICUS/S2' from 2015, L2A: 'COPERNICUS/S2_SR' from 2017
      AreaScale: 20.0, //resolution
      trendSeries: ['Area', 'Change'],
      visParams: {min: -1, max: 1, palette: ['red', 'white', 'green']},
      legend: [ {'Forest': 'green'}, {'No Forest': 'white'} ],
  }
};
var defaultLayer = layerProperties[defaultDB];
// Some pre-set locations of interest that will be loaded into a pulldown menu.
var locationDict = {
  'Namibia': {lon: 18, lat: -22, zoom: 5, polygon: {}},
  'Botswana': {lon: 24, lat: -22, zoom: 5, polygon: {}}
};


/****************************************************************************************
* Internal variables and config
*****************************************************************************************/
var FOREST_DATASET;
var CountryNames = ee.List(COUNTRY_DATASET.aggregate_array(country_name_key)).distinct().getInfo();

for(var nkey in CountryNames){
  locationDict[CountryNames[nkey]] = {lon: 0, lat:0, zoom:5, polygon:{}};
}
//
for (var key in locationDict) {
  //Select a specific country
  locationDict[key].polygon = COUNTRY_DATASET
      .filterMetadata(country_name_key,'equals',key)
      .first().geometry();

  if(locationDict[key].lon===0 && locationDict[key].lat===0){
    var cent = ee.Geometry(locationDict[key].polygon).centroid();
    locationDict[key].lon = cent.coordinates().get(0);
    locationDict[key].lat = cent.coordinates().get(1);
  }
}

var defaultLocation = locationDict[defaultCountry];

/****************************************************************************************
* Help panel 
*****************************************************************************************/
var help_text = ui.Label({
  value: '-------------------------------------------------------------------------------------\n'+
  'This App can be used to evaluate the trend in forest area and evaluate UN SDG Indicator 15.1.1\n' + 
  '-------------------------------------------------------------------------------------\n'+
  'The software is provided "AS IS", without warranty of any kind, express or ' +
  'implied, including but not limited to the warranties of merchantability, ' +
  'fitness for a particular purpose and noninfringement. In no event shall the ' +
  'authors or copyright holders be liable for any claim, damages or other ' +
  'liability, whether in an action of contract, tort or otherwuse, arising from, ' +
  'out of or in connection with the software or the use or other dealings in the ' +
  'software.',
  style: {position: 'top-left', margin:'10px 4px 4px 4px', padding:'0px', 
  width: '330px', whiteSpace: 'pre-wrap', color:'#44546A', backgroundColor: GUIPREF.BACKCOLOR}});
var help_quit = ui.Button({label: 'X',style: {position: 'top-right', color: 'red', backgroundColor: GUIPREF.BACKCOLOR}});
var help_panel = ui.Panel({
  layout: ui.Panel.Layout.absolute(),
  widgets: [help_quit, help_text],
  style: {width: '450px', height: '150px', color:GUIPREF.TEXTCOLOR, backgroundColor: GUIPREF.BACKCOLOR}
});

function show_help_panel(text) {
  help_panel.style().set('shown', true);
  help_text.setValue(text);
  help_panel.style().set({margin:'4px 4px 4px 4px'});
}
help_quit.onClick( function() {help_panel.style().set('shown', false); });

/****************************************************************************************
* Clear map panel
*****************************************************************************************/
function ClearMap(array){
  while(mapPanel.layers().length()>0){
    mapPanel.remove(mapPanel.layers().get(0));
  }
}

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

/*****************************************************************************************
* GUI: Create a map panel.
*****************************************************************************************/
var mapPanel = ui.Map();
mapPanel.add(help_panel);
// Take all tools off the map except the zoom and mapTypeControl tools.
mapPanel.setControlVisibility({all: true, zoomControl: true, mapTypeControl: true});

defaultLocation.polygon = defaultLocation.polygon.getInfo();
defaultLocation.lat = defaultLocation.lat.getInfo();
defaultLocation.lon = defaultLocation.lon.getInfo();

mapPanel.setCenter(
    Number(defaultLocation.lon), 
    Number(defaultLocation.lat), 
    Number(defaultLocation.zoom) );

/****************************************************************************************
* GUI: Create a plotting/results panel.
****************************************************************************************/
var graphPanel = ui.Panel([],  'flow', 
  {border: '1px solid black', width: '300px', height: '200px', position: 'bottom-right', shown:false } );
graphPanel.add(ui.Label('Forest Area Over Time', {fontWeight: 'bold', color:GUIPREF.TEXTCOLOR}))

mapPanel.add(graphPanel)
ui.root.widgets().reset([toolPanel, mapPanel]);

/****************************************************************************************
* Get clipping polygon from USGS dataset or shapefile
*****************************************************************************************/
var GetClippingPolygon = function () {
  var poly;
  
  if(defaultAssetName.length>0){
    var Countrydataset = ee.Collection.loadTable(defaultAssetName);

    //merge all features
    if(RegionID>0){
      Countrydataset = ee.Feature(Countrydataset.toList(1,RegionID-1).get(0));
    }else{
      Countrydataset = Countrydataset.union().first();
    }
    poly = Countrydataset.geometry().getInfo();
    
  }else{
    if(defaultRegion=='All'){
      poly = defaultLocation.polygon;
    }else{
      poly = AdministrativeRegions.RegionPolygon(defaultCountry, defaultRegion);
    }
  }
  return poly;
};

/****************************************************************************************
* Display forest layer for the selected year and region
*****************************************************************************************/
var DisplayForestLayer = function(){
  loadingLabel.style().set('shown',true);
  //Generate forest layer(s) based on Global surface forest dataset or S2 data
  var ImgForestRegion;
  if(defaultDB=='MODIS'){
    ImgForestRegion = DisplayForestLayer_MODIS();
  }else{
    ImgForestRegion = DisplayForestLayer_S2(defaultDB);
  }
  //Clear map panel
  ClearMap();
  
  //Define region outline
  var poly = GetClippingPolygon();
  var gridOutlines = ee.Image().toByte().paint(ee.Feature(poly), 'red', 2); 
  
  //plot outline
  mapPanel.add(ui.Map.Layer(gridOutlines, {}, 'Region'));
  
  //plot forest layer
  mapPanel.add(ui.Map.Layer(ImgForestRegion.select(defaultLayer.band), 
    defaultLayer.visParams, 
    'EVI_' + defaultYear, 
    defaultLayer.defaultVisibility));
  
  //plot everything
  mapPanel.add(ui.Map.Layer(ImgForestRegion,{},'All',false));
    
  //Calculate total country area
  var stats = ee.Image.pixelArea().rename('area').reduceRegion({
      reducer: ee.Reducer.sum(), 
      geometry: poly, 
      scale: defaultLayer.AreaScale,
      maxPixels: 1e11
    });
  var cntarea = ee.Number(stats.get('area')).divide(1e6);

  //Calculate forest extent
  var area = ee.Number(0);
  var ForestInfo;
  area = ee.Number(forestCount(ImgForestRegion, poly, defaultLayer.AreaScale)).divide(1e6);

  area = area.getInfo();
  cntarea = cntarea.getInfo();
  ForestInfo = ui.Label('Extent of forest during ' + defaultYear + ' [' + defaultDB + ']:\n'
    + '*Area='+area.toFixed(1)+'km2 (' + (area*100.0/cntarea).toFixed(2) + '% coverage)',
    {fontWeight: 'bold', color:GUIPREF.TEXTCOLOR});

  graphPanel.widgets().set(1, ForestInfo);
  graphPanel.style().set('shown',true);
  graphPanel.style().set('height','120px');
  //
  loadingLabel.style().set('shown',false);
}

/*---------------------------------------------------------------------------------------
* Display forest layer from MODIS
---------------------------------------------------------------------------------------*/
function maskMODISclouds(image) {
  var qa = image.select('SummaryQA');
  // good data
  var mask = qa.eq(0);
  return image.updateMask(mask).divide(10000);
}

var DisplayForestLayer_MODIS = function(){
  var DateStart, DateEnd;
  var dataset, layer;
  var ImgForestRegion;
  
  //clip region
  var poly = GetClippingPolygon();
  
  if(defaultYear<defaultLayer.availableYears[0] || defaultYear>defaultLayer.availableYears[defaultLayer.availableYears.length-1]){
    show_help_panel('Year ' + defaultYear + ' is not available for the current dataset: ' + defaultDB);
    ImgForestRegion = ee.Image.constant(0.0).rename('EVI').clip(poly)
    ImgForestRegion = ImgForestRegion.addBands(ee.Image.constant(0.0).rename('NDVI'));
    return ImgForestRegion;
  }
  
  //load data
  FOREST_DATASET = ee.ImageCollection(defaultLayer.DATASET_name);
  
  //filter data by date
  DateStart = defaultYear + '-01-01';
  DateEnd = defaultYear + '-12-31';
  dataset = FOREST_DATASET.filter(ee.Filter.date(DateStart, DateEnd));
  dataset = dataset.select(['NDVI','EVI','SummaryQA'])
    .map(maskMODISclouds)
    .median()
    .clip(poly);
  //
  ImgForestRegion = ee.Image(dataset)
    .set('year', parseInt(defaultYear));
    
  var EVI = dataset.select('EVI');
  
  ImgForestRegion = ImgForestRegion.addBands(
    EVI.gte(EVI_min).and(EVI.lte(EVI_max))
    .selfMask()
    .rename('forest'),['forest'],true);
    
  return ImgForestRegion;
}
/*---------------------------------------------------------------------------------------
* Display forest layer from Sentinel-2 EVI
---------------------------------------------------------------------------------------*/
function maskS2clouds(image) {
  var qa = image.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(mask).divide(10000);
}
var DisplayForestLayer_S2 = function(S2_DWI_type){
  var DateStart, DateEnd;
  var dataset, layer
  //clip region
  var poly = GetClippingPolygon();
  if(defaultYear<defaultLayer.availableYears[0] || defaultYear>defaultLayer.availableYears[-1]){
    show_help_panel('Year ' + defaultYear + ' is not available for the current dataset: ' + defaultDB);
    return;
  }
  
  //Calculate EVI from Sentinel-2
  DateStart = defaultYear + '-01-01';
  DateEnd = defaultYear + '-12-31';
  // Create an initial mosiac, which we'll visualize in a few different ways.
  var image = ee.ImageCollection(defaultLayer.DATASET_name)
      .filterDate(DateStart, DateEnd)
      // Pre-filter to get less cloudy granules.
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .select(['B3','B8','B11','QA60'])
      .map(maskS2clouds)
      //.map(function(img) {return img.clip(poly);})
      .median();

  //only interested in forest bodies --> EVI>(EVI_threshold) 
	//EVI = G * (NIR-RED) / (NIR + C1*RED - C2*BLUE + L)
	var EVI = image.clip(poly);
	EVI = EVI.expressions('G*(NIR-RED)/(NIR+C1*RED-C2*BLUE+L)',
    { BLUE:EVI.select('B2'),
      RED:EVI.select('B4'),
      NIR:EVI.select('B8'),
      L: 1.0, 
      C1: 6.0,
      C2: 7.5,
      G: 2.5}).rename(['EVI']);
  
  //mask as for MODIS
  ImgForestRegion = ImgForestRegion.addBands(EVI);
  
  ImgForestRegion = ImgForestRegion.addBands(
      EVI.gte(EVI_min).and(EVI.lte(EVI_max))
      .selfMask() 
      .rename('forest'),['forest'],true);
  //
  return ImgForestRegion;
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
    var LstArea = ee.List([]);
    var LstDate =  ee.List([]);
    var DateStart, DateEnd, yearRange;
    var ImgForestRegion;
    var TimeSeriesMap = ee.List([]);
    //
    var defaultLayer0 = defaultLayer;
    var defaultYear0 = defaultYear;
    //
    var poly = GetClippingPolygon();
    //
    //define layer to use
    defaultLayer = layerProperties[defaultDB];
    yearRange = defaultLayer.availableYears;

    //LOOP!?
    for(var i=0;i<yearRange.length;i++){
      defaultYear = yearRange[i];
      //
      if(defaultDB=='MODIS'){
        ImgForestRegion = DisplayForestLayer_MODIS();
      }else{
        ImgForestRegion = DisplayForestLayer_S2(defaultDB);
      }       
      
      //Select band to use
      //ImgForestRegion = ImgForestRegion.select(defaultLayer.band);
      //Save current time point
      LstDate = LstDate.add( yearRange[i] );
      //----------------------------------------------------------------------------------------
      var area = ee.Number(forestCount(ImgForestRegion, defaultLocation.polygon, defaultLayer.AreaScale)).divide(1e6);

      TimeSeriesMap = TimeSeriesMap.add( ImgForestRegion.select([defaultIndice,'forest']) );
      LstArea = LstArea.add(area);
    }
    defaultYear = defaultYear0;
    defaultLayer = defaultLayer0;
    //
    data.area = LstArea.getInfo();
    data.date = LstDate.getInfo();
    //5-year average
    var gamma;
    var beta = AVG.Average5(data.area, 2001-2005);
    for(i=0;i<data.area.length;i++){
        gamma = AVG.Average5(data.area,i);
        data.pctchange.push( (beta-gamma)/beta*100 );
    }
    //Convert
    TimeSeriesMap = ee.ImageCollection.fromImages(TimeSeriesMap);
    //
    return {data: data, TimeSeriesMap: TimeSeriesMap, Region:poly};
}

/****************************************************************************************
* Plot forest area over time period
*****************************************************************************************/
var plotTrend = function(){
  genGraphBtn.setLabel('Calculating...');
  var alldata = CalcForestArea();
  var areas;
  var title;
  var time_range = alldata.data.date;

  areas = [alldata.data.area, alldata.data.pctchange];
  //Print title
  if(defaultAssetName.length===0){
    title = 'Forest Area Over Time over ' + defaultCountry + '.' + defaultRegion +
        ' during '+ defaultYear;
  }else{
    title = 'Forest Area Over Time over ' + defaultAssetName + '.' + RegionID + 
        ' during '+ defaultYear;
  }

  var forestChart = ui.Chart.array.values(areas, 1, time_range)
      .setChartType('LineChart')
      .setSeriesNames(defaultLayer.trendSeries)
      .setOptions({
        title: title,
        vAxes: {
          0: { title: 'Area [km2]' },
          1: {
            title: '% Area Change (Ref: 2001-2005)',
            baselineColor: 'transparent'
            }
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
  graphPanel.widgets().set(1, forestChart);
  graphPanel.style().set('shown',true);
  graphPanel.style().set('height','250px');
  genGraphBtn.setLabel('Generate Trend Graph');
  //Plot time series
  ClearMap();    
  //plot outline
  mapPanel.add(ui.Map.Layer(ee.Image().toByte().paint(ee.Feature(alldata.Region), 'red', 2), {}, 'Region'));
  
  //forest mask
  var LE = ee.Number( time_range.length )
  var forest_mask = alldata.TimeSeriesMap
                    .map(function(f) {return f.select('forest').unmask(0)})
                    .sum().gt(0.0)
                    .rename('forest_mask');

  //apply forest mask
  alldata.TimeSeriesMap = alldata.TimeSeriesMap
      .map(function(f) {return f.unmask(0).updateMask(forest_mask)})

  //Calculate time series
  var combi_reducer = ee.Reducer.mean()
                    .combine(ee.Reducer.minMax(), '', true)
                    .combine(ee.Reducer.variance(), '', true)
                    .combine(ee.Reducer.stdDev(), '', true)
                    .combine(ee.Reducer.percentile([0,25,50,75,99]), '', true)
                    .combine(ee.Reducer.count(), '', true);


  var timeseriesmap = alldata.TimeSeriesMap
      .reduce(combi_reducer)
      .selfMask();

  //add permanent
  timeseriesmap = timeseriesmap.addBands(
      (timeseriesmap.select('forest_count').eq(LE)).gt(0.0)
      .updateMask(forest_mask)
      .rename('forest_permanent')
    );

  //add forest change band
  var forest_reference,forest_exam_range;
  var forest_loss, forest_gain;
  
  //define reference forest level
  forest_reference = alldata.TimeSeriesMap
      .select('forest')
      .filterMetadata('year', 'equals',parseInt(defaultYear)).first();
  //
  forest_exam_range = alldata.TimeSeriesMap
      .select('forest')
      .filterMetadata('year', 'greater_than',parseInt(defaultYear));
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
      
  //
  setLegend(TimeSeriesParam);
  
  mapPanel.add(ui.Map.Layer(timeseriesmap, TimeSeriesParam.visParam, TimeSeriesParam.name,true));
  mapPanel.add(ui.Map.Layer(alldata.TimeSeriesMap, {}, 'Time Series',false));  
};

/****************************************************************************************
* Plot forest area over time period
*****************************************************************************************/
var exportMap = function(){
  show_help_panel('Generating Export Task for '+ defaultCountry + ' in ' + defaultYear )
  var image = (mapPanel.layers().get(1)).get('eeObject');

  var poly = GetClippingPolygon();
  Export.image.toDrive({
      image: image,
      description: 'forest_map_for_' + RegionID + '_' + defaultYear ,
      scale: defaultLayer.AreaScale,
      region: poly,
      maxPixels: 1e10,
      skipEmptyTiles: false,
      crs: EXPORT_CRS,
      fileFormat: 'GeoTIFF'
      });
}

/****************************************************************************************
* Define the pulldown menu.  Changing the pulldown menu changes the displayed year
*****************************************************************************************/
var yearSelect = ui.Select({
  items: Array.apply(null, {length: 19}).map( function(number, index){return (2000+index).toString()}),
  value: defaultLayer.availableYears[1],
  style: GUIPREF.SELECT_STYLE,
  onChange: function(year) {
    defaultYear = year;
  }
});

// Add the select to the toolPanel with some explanatory text.
var yearPanel = ui.Panel([
  ui.Label( 'Reference Year:', GUIPREF.LABEL_T_STYLE), 
  yearSelect],
  ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE);
  
/****************************************************************************************
* Define the pulldown menu.  Changing the pulldown menu changes the displayed location
*****************************************************************************************/
// Create the location pulldown.
var locations = Object.keys(locationDict);
var index = locations.sort().indexOf(defaultCountry);

var countrySelect = ui.Select({
  items: locations.sort(),
  value: locations[index],
  style: GUIPREF.SELECT_STYLE,
  onChange: function(value) {
    defaultLocation = locationDict[value];
    defaultCountry = value;
    //
    defaultLocation.polygon = ee.Geometry(defaultLocation.polygon).getInfo();
    defaultLocation.lat = ee.Number(defaultLocation.lat).getInfo();
    defaultLocation.lon = ee.Number(defaultLocation.lon).getInfo();
	//Get administrative regions
  var RegionLst = AdministrativeRegions.RegionsList(defaultCountry);
	defaultRegion = 'All';
	var regionSelect = ui.Select({
      items: RegionLst,
      value: RegionLst[0],
      style: GUIPREF.SELECT_STYLE,
      onChange: function(value) {
        defaultRegion = value;
      }
    });
    predefLocPanel.widgets().set(2,regionSelect);
	
    //Update center of map
    mapPanel.setCenter(defaultLocation.lon, defaultLocation.lat, defaultLocation.zoom);
  }
});

var RegionLst = AdministrativeRegions.RegionsList(defaultCountry);
var regionSelect = ui.Select({
  items: RegionLst,
  value: RegionLst[0],
  style: GUIPREF.SELECT_STYLE,
  onChange: function(value) {
    defaultRegion = value;
  }
});

/******************************************************************************************
* GUI: dataset selection.
******************************************************************************************/
var DBSelect = ui.Select({
  items: availableDB,
  value: defaultDB,
  style: GUIPREF.SELECT_STYLE,
  onChange: function(value) {
    defaultDB = value;
    //update layer prop
    defaultLayer = layerProperties[defaultDB];
    //Update year drop down
    yearSelect.setValue(defaultLayer.availableYears[0]);
    //Update legend
    setLegend(defaultLayer.legend);
  }
});    
var IndiceSelect = ui.Select({
  items: ['EVI','NDVI'],
  value: defaultIndice,
  style: GUIPREF.SELECT_STYLE,
  onChange: function(value) {
    defaultIndice = value;
  }
});    
GUIPREF.EDIT_STYLE.width = '50px';
var evi_min_textbox = ui.Textbox({
  value: EVI_min,
  placeholder: 'EVI min',
  style: GUIPREF.EDIT_STYLE,
  onChange: function(text) {
    EVI_min = Number(text);
    show_help_panel('EVI Min ' + EVI_min );
  }
});
var evi_max_textbox = ui.Textbox({
  value: EVI_max,
  placeholder: 'EVI max',
  style: GUIPREF.EDIT_STYLE,
  onChange: function(text) {
    EVI_max = Number(text);
    show_help_panel('EVI Max ' + EVI_max );
  }
});

var DBPanel = ui.Panel([ui.Label('Dataset:', GUIPREF.LABEL_T_STYLE),   DBSelect,
  
  ui.Button('?',  function() {show_help_panel(['MODIS: MOD13A2.006 Terra Vegetation Indices(2000-) \nS2: Level 1C Sentinel-2 data used to calculate EVI. (2015-)'])}, false, GUIPREF.HELP_BTN_STYLE)], 
  ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE);

var IndicePanel = ui.Panel([ui.Label('Indice:', GUIPREF.LABEL_T_STYLE),   IndiceSelect,
  evi_min_textbox,evi_max_textbox,
  ui.Button('?',  function() {show_help_panel(['EVI: Enhanced Vegetation Index. Range: 0.2-0.8.\nNDVI: Normalized Difference Vegetation Index.'])}, false, GUIPREF.HELP_BTN_STYLE)], 
  ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE);


/****************************************************************************************
* GUI: Text box for the use of an asset file
*****************************************************************************************/
GUIPREF.EDIT_STYLE.width = '200px';
var asset_textbox = ui.Textbox({
  placeholder: 'users/.../',
  style: GUIPREF.EDIT_STYLE,
  onChange: function(text) {
    defaultAssetName = text;
    show_help_panel('New asset to use ' + defaultAssetName );
  }
});

GUIPREF.EDIT_STYLE.width = '50px';
var asset_LID_textbox = ui.Textbox({
  placeholder: 'Layer ID',
  style: GUIPREF.EDIT_STYLE,
  onChange: function(text) {
    active_preshape.setValue(false);
    active_gee_asset.setValue(true);
    RegionID = Number(text);
    show_help_panel('New Region ID:' + RegionID);    
  }
});

/******************************************************************************************
* GUI: Selection of a predefined shape.
******************************************************************************************/
var helppreshape = ui.Button('?',  
function() {show_help_panel('Select the Region Of Interest, based on USDOS LSIB. Regional levels are defined from GAUL level 1, 2008.')}, 
false, GUIPREF.HELP_BTN_STYLE);
var active_preshape = ui.Checkbox( {label:'Predefined:', value: true, style: GUIPREF.CKBOX_STYLE} );
active_preshape.setDisabled(true);
var predefLocPanel = ui.Panel( [active_preshape,countrySelect, regionSelect,helppreshape],
  ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE);

var helpgeeasset = ui.Button('?',  function() {show_help_panel('Select a region from your GEE ASSETS with the defined layer ID.')}, false, GUIPREF.HELP_BTN_STYLE);
var active_gee_asset = ui.Checkbox( {label:'GEE ASSET Shapefile:', value: false, style: GUIPREF.CKBOX_STYLE} );
active_gee_asset.setDisabled(true);
var loadingLabel = ui.Label({
      value: 'Loading...',
      style: {stretch: 'vertical', color: 'gray', shown: false, backgroundColor: GUIPREF.BACKCOLOR}
    })
var assetPanel = ui.Panel([
    active_gee_asset, 
    ui.Panel([asset_textbox, asset_LID_textbox, helpgeeasset, loadingLabel],ui.Panel.Layout.flow('horizontal',true),GUIPREF.CNTRL_PANEL_STYLE)
  ],
  'flow', GUIPREF.CNTRL_PANEL_STYLE);

var LocationPanel = ui.Panel([ui.Label( 'Location:', GUIPREF.LABEL_T_STYLE),  predefLocPanel, assetPanel], 'flow', GUIPREF.CNTRL_PANEL_STYLE);

toolPanel.add(ui.Panel([DBPanel, IndicePanel, yearPanel, LocationPanel],ui.Panel.Layout.flow('vertical',true)));
yearSelect.setValue(defaultLayer.availableYears[0]);


/******************************************************************************************
* GUI: Create the legend.
******************************************************************************************/
// Define a panel for the legend and give it a tile.
var legendPanel = ui.Panel({style: GUIPREF.LEGEND_STYLE});
mapPanel.add(legendPanel);

var legendTitle = ui.Label('Legend',  GUIPREF.LEGEND_TITLE_STYLE);
legendPanel.add(legendTitle);

// Define an area for the legend key itself.
// This area will be replaced every time the layer pulldown is changed.
var keyPanel = ui.Panel({style: {backgroundColor:GUIPREF.BACKCOLOR}});
legendPanel.add(keyPanel);

function setLegend(legend) {
  // Loop through all the items in a layer's key property,
  // creates the item, and adds it to the key panel.
  keyPanel.clear();
  for (var i = 0; i < legend.length; i++) {
    var item = legend[i];
    var name = Object.keys(item)[0];
    var color = item[name];
    var colorBox = ui.Label('', {
      backgroundColor: color,
      // Use padding to give the box height and width.
      padding: '8px',
      margin: '0'
    });
    // Create the label with the description text.
    keyPanel.add(
        ui.Panel([colorBox, ui.Label(name, GUIPREF.LEGEND_TEXT_STYLE)], ui.Panel.Layout.Flow('horizontal')),{backgroundColor:'red'});
  }
}

// Set the initial legend.
setLegend(defaultLayer.legend);

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
  function() {show_help_panel('Update the map with the forest layer calculated from the selected dataset, year.')},
  false, GUIPREF.HELP_BTN_STYLE);
var genMapBtn = ui.Button( 'Update Map', DisplayForestLayer, false, GUIPREF.BUTTON_STYLE);
var mapCntrl = ui.Panel([genMapBtn, helpmap],ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
//-------------------------------------------------------------  

var helprange = ui.Button('?', 
  function() {show_help_panel('Generate a graph with the change in forest area over a time frame in years')},
  false, GUIPREF.HELP_BTN_STYLE);
var genGraphBtn = ui.Button( 'Generate Trend Graph', plotTrend, false, GUIPREF.BUTTON_STYLE);
var graphCntrl = ui.Panel([genGraphBtn,helprange],  ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
//-------------------------------------------------------------  
var helpexp = ui.Button('?', function() {show_help_panel('Export current layers to Google Drive folder.')}, false, GUIPREF.HELP_BTN_STYLE);

var expMapBtn = ui.Button( 'Export Current Map', 
  exportMap, false, GUIPREF.BUTTON_STYLE);
var exportPanel = ui.Panel([expMapBtn, helpexp],ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
//-------------------------------------------------------------  
var trendPanel = ui.Panel([mapCntrl, graphCntrl], 
    ui.Panel.Layout.Flow('vertical'));
    
toolPanel.add(trendPanel);
toolPanel.add(exportPanel);
toolPanel.add(viewPanel);
toolPanel.add(mailPanel);

/*---------------------------------------------------------------------------------
*  Reference Panel: Source for MODIS and S2 data
---------------------------------------------------------------------------------*/
// Create a hyperlink to an external reference.
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
  modis_info, sentinel_info, gfw_info],'flow', GUIPREF.CNTRL_PANEL_STYLE);

toolPanel.add(referencePanel);
