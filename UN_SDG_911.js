
/************************************************************************************
 * Configure layers and locations
 ************************************************************************************/

var AreaScale = 30;
//Road data set downloaded from: http://download.geofabrik.de/africa/namibia.html
var ROAD_DATASET = ee.Collection.loadTable('users/rayoly/NAMIBIA_ROADS');
//Water data set: GSW
var WATER_DATASET = ee.ImageCollection('JRC/GSW1_0/YearlyHistory');
//DEM
var DEM_DATASET = ee.Image('CGIAR/SRTM90_V4');
//Population dataset
//GHSL: Global Human Settlement Layers, Population Grid 1975-1990-2000-2015 (P2016)
var POP_DATASET = ee.ImageCollection('JRC/GHSL/P2016/POP_GPW_GLOBE_V1'); 
var SETTLEMENT_GRID = ee.ImageCollection('JRC/GHSL/P2016/SMOD_POP_GLOBE_V1');
var WORLDPOP_DATASET = ee.ImageCollection("WorldPop/POP");

//Use dataset USDOS LSIB 2017
var COUNTRY_DATASET = ee.FeatureCollection('USDOS/LSIB/2017');
var defaultCountry = 'Namibia';
var CountryCode = 'NAM';
var defaultYear = '2015';
var defaultAssetName = '';
var defaultDist2Road = 2000;
var availableYears = ['1990','2000','2010','2015'];
//CRS
var EXPORT_CRS = 'EPSG:4326';
var RegionID = 0;
/***********************************************************************************/

var layerProperties = {
  'Year': {
    name: 'waterClass',
    visParams: {min: 0, max: 3, palette: ['white', 'cyan', 'blue']},
    legend: [
      {'3': 'blue'}, {'2': 'cyan'}, {'1': 'white'}
    ],
    defaultVisibility: true
  }
};

// Some pre-set locations of interest that will be loaded into a pulldown menu.
var locationDict = {
  'Namibia': {lon: 18, lat: -22, zoom: 5, polygon: {}},
  'Botswana': {lon: 24, lat: -22, zoom: 5, polygon: {}},
  'France': {lon: 0, lat: 0, zoom: 5, polygon: {}},
  'Germany': {lon: 0, lat: 0, zoom: 5, polygon: {}}
};

var CountryNames = ee.List(COUNTRY_DATASET.aggregate_array('COUNTRY_NA')).distinct().getInfo();

for(var nkey in CountryNames){
  locationDict[CountryNames[nkey]] = {lon: 0, lat:0, zoom:5, polygon:{}};
}

for (var key in locationDict) {
  //Select a specific country
  locationDict[key].polygon = COUNTRY_DATASET
      .filterMetadata('COUNTRY_NA','equals',key)
      .first().geometry();

  if(locationDict[key].lon===0 && locationDict[key].lat===0){
    var cent = ee.Geometry(locationDict[key].polygon).centroid();
    locationDict[key].lon = cent.coordinates().get(0);
    locationDict[key].lat = cent.coordinates().get(1);
  }
}


var defaultLocation = locationDict[defaultCountry];
defaultLocation.polygon = defaultLocation.polygon.getInfo();
defaultLocation.lat = defaultLocation.lat.getInfo();
defaultLocation.lon = defaultLocation.lon.getInfo();


/*
 * Map panel configuration
 */
// Now let's do some overall layout.
// Add these to the interface.
ui.root.setLayout(ui.Panel.Layout.flow('horizontal'));

/*
 * Additional component configuration
 */
/*---------------------------------------------------------------------------------
* Create a control panel.
---------------------------------------------------------------------------------*/
var header = ui.Label('SDG 9.1.1: Rural Access Index', {fontSize: '28px', color: 'blue'});
var text = ui.Label(
    'Results from analysis of GSW, DEM, WorldPop,... data characterizing access to road.',
    {fontSize: '11px'});
var toolPanel = ui.Panel([header, text], 
    'flow', 
    {width: '300px'});

/*---------------------------------------------------------------------------------
* Create a map panel.
---------------------------------------------------------------------------------*/
var mapPanel = ui.Map();
// Take all tools off the map except the zoom and mapTypeControl tools.
mapPanel.setControlVisibility(
    {all: true, zoomControl: true, mapTypeControl: true});
mapPanel.setCenter(
    defaultLocation.lon, defaultLocation.lat, defaultLocation.zoom);

/*---------------------------------------------------------------------------------
* Create a plotting panel.
---------------------------------------------------------------------------------*/
var graphPanel = ui.Panel([ui.Label('Results', {fontSize: '28px', color: 'blue'})], 
      'flow', 
      {width: '300px'});
var chart = ui.Chart([],'LineChart');

/*---------------------------------------------------------------------------------
*  
---------------------------------------------------------------------------------*/
ui.root.widgets().reset([toolPanel, mapPanel, graphPanel]);

/*---------------------------------------------------------------------------------
*  
---------------------------------------------------------------------------------*/
// Create a hyperlink to an external reference.
var link = ui.Label(
    'Articles...', {},
    'https://www.google.com');
var linkPanel = ui.Panel(
    [ui.Label('For more information', {fontWeight: 'bold'}), link]);
toolPanel.add(linkPanel);

// Create a layer selector pulldown.
// The elements of the pulldown are the keys of the layerProperties dictionary.

/****************************************************************************************
* Get cvlipping polygon from USGS dataset or shapefile
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
    poly = defaultLocation.polygon;
  }
  return poly;
}

/******************************************************************************
 * 
*******************************************************************************/
var CalcRAI = function(Year, CountryAbbr){
  
  var data = {year:[], RAI:[],
    pop_within_dist:[], total_pop:[], worldpop_total_pop: [],
    ghslPop:[], worldpop:[], access_to_road:[], 
    settlement: [], rural:[],
    ImgWaterRegion:[], walkable_Area:[], RoadImg:[] };
    
  var poly = GetClippingPolygon();
  
  for(var i=0;i<Year.length;i++){
    print('Current Year: ' + Year[i]);
    /*--------------------------------------------------------
    * Retrieve water dataset
    --------------------------------------------------------*/
    var waterClass = WATER_DATASET
        .filter(ee.Filter.date(Year[i] + '-01-01', Year[i] + '-12-31'))
        .select('waterClass')
        .first();
    
    data.ImgWaterRegion = waterClass
        .clip(poly)
        .gt(1.0)
        .focal_max(30.0, 'circle','meters')
        .focal_min(30.0, 'circle','meters');
    
    /*--------------------------------------------------------
    * Retrieve Global population dataset:
    *   Censuses
    * or
    *   WorldPop, Landscan of OakRidge, GRUMP
    ---------------------------------------------------------*/
    data.ghslPop = POP_DATASET
      .filter(ee.Filter.date(Year[i] + '-01-01', Year[i] +'-12-31'))
      .first();
    print(data.ghslPop)
    data.ghslPop = data.ghslPop.clip(poly);
    data.ghslPop  = data.ghslPop.mask(data.ghslPop.gt(0.0));
    //
    data.worldpop = WORLDPOP_DATASET
        .filter(ee.Filter.eq('country',CountryAbbr))
        .filter(ee.Filter.eq('year',Number(Year[i])))
        .filter(ee.Filter.eq('UNadj','no'))
        .first();
    print(data.worldpop)
    data.worldpop  = data.worldpop.clip(poly);
    data.worldpop  = data.worldpop.mask(data.worldpop.gt(0.0));

    data.settlement = SETTLEMENT_GRID
        .filter(ee.Filter.date(Year[i] + '-01-01', Year[i] +'-12-31'))
        .first();
    print(data.settlement)
    data.settlement  = data.settlement.clip(poly);
    data.rural  = data.settlement.mask(data.settlement.eq(1.0));

    /*--------------------------------------------------------
    * Retrieve road network
    --------------------------------------------------------*/
    
    var prop = {
        properties: ['code'],
        reducer: ee.Reducer.first()
    };
    data.RoadImg = ROAD_DATASET
        .reduceToImage(prop)
        .focal_max(defaultDist2Road, 'circle','meters');
    
    /*--------------------------------------------------------
    * Retrieve road conditions
    --------------------------------------------------------*/

    /*--------------------------------------------------------
    * 
    --------------------------------------------------------*/
    data.walkable_Area = (ee.Image.constant(1.0)).clip(poly);
    
    //the DEM is used to increase the cost=distance=pixel size * sqrt(1+slope^2)
     var dem = DEM_DATASET.clip(poly);
    dem = ee.Algorithms.Terrain(dem);
    var dem_slope = dem.select('slope').polynomial([1.0,0,1.0]).sqrt();
    data.walkable_Area = data.walkable_Area.multiply(dem_slope);
    
    //Walkable area must no contain any water area:
    data.walkable_Area = data.walkable_Area.multiply( data.ImgWaterRegion.unmask().not() );
    //open filter
    data.walkable_Area = data.walkable_Area
        .focal_min(30.0, 'circle','meters')
        .focal_max(30.0, 'circle','meters');
    
    //Now need to overlap this layer with the road layer.
    //The overlap region give the number of units having access to a road <2km away
    //var rural_pop = data.ghslPop.neq(0);
    var rural_pop = (data.ghslPop).multiply(data.rural);
    data.access_to_road = ((data.RoadImg.neq(0)).and(rural_pop)).multiply(data.ghslPop);

    /*
    * Print Statistics
    */
    var stats = data.access_to_road.reduceRegion({
        reducer: ee.Reducer.sum(), 
        geometry: poly, //scale: 100,
        maxPixels: 1e12
      });
    var gbl_stats = data.ghslPop.reduceRegion({
        reducer: ee.Reducer.sum(), 
        geometry: poly, //scale: 100,
        maxPixels: 1e12
      });
    var worldpop_gbl_stats = data.worldpop.reduceRegion({
        reducer: ee.Reducer.sum(), 
        geometry: poly, //scale: 100,
        maxPixels: 1e12
      }); 
    //Save processed results
    data.year.push(Year);
    data.pop_within_dist.push( ee.Number(stats.get('first')) );
    data.total_pop.push( ee.Number(gbl_stats.get('population_count')) );
    data.worldpop_total_pop.push( ee.Number(worldpop_gbl_stats.get('population')) );   

    var N =  data.year.length-1;
    data.RAI.push( (data.pop_within_dist[N]).multiply(100).divide(data.total_pop[N]) );
  }
  return data;
};

/****************************************************************************************
* Display water layer for the selected year and region
*****************************************************************************************/
var DisplayPopLayer = function(){
    var data = CalcRAI([defaultYear], CountryCode);
    
    data.RAI = data.RAI.map(function(d){return d.getInfo()});
    data.total_pop = data.total_pop.map(function(d){return d.getInfo()});
    data.worldpop_total_pop = data.worldpop_total_pop.map(function(d){return d.getInfo()});
    data.pop_within_dist = data.pop_within_dist.map(function(d){return d.getInfo()});
    /*
    * Plots MAPS
    */
    //mapPanel.layers().forEach( function(layer,index) {mapPanel.remove(layer)});
    
    if(mapPanel.layers().length()>0){
      mapPanel.remove(mapPanel.layers().get(6));
      mapPanel.remove(mapPanel.layers().get(5));
      mapPanel.remove(mapPanel.layers().get(4));
      mapPanel.remove(mapPanel.layers().get(3));
      mapPanel.remove(mapPanel.layers().get(2));
      mapPanel.remove(mapPanel.layers().get(1));
      mapPanel.remove(mapPanel.layers().get(0));
    }
    //Plot walkable area
    mapPanel.addLayer(data['walkable_Area'],{palette: ["ffffff","55bbff","0000ff"]},'Walkable Area',false);
  
    //Plot water area
    mapPanel.addLayer(data['ImgWaterRegion'],{palette:'0000ff'},'Water',false);
    
    //Plot population
    mapPanel.addLayer(data['ghslPop'],  {
      min: 0,
      max: 25.0,
      opacity: 0.5,
      palette: ['orange', 'red', 'darkred']
    }, 'GHSL Population');
    mapPanel.addLayer(data['worldpop'],  {
      min: 0,//max: 1.0,
      opacity: 0.5,
      palette: ['white', 'yellow', 'green']
    }, 'WORLDPOP Population');
    mapPanel.addLayer(data['settlement'],  {
      min: 0, max: 3.0,
      opacity: 0.5,
      palette: ['white', 'yellow', 'blue']
    }, 'Settlement',false);    
    
    //Plot road network
    mapPanel.addLayer(data['RoadImg'], {color:'ff0000'}, 'Road Network',false);

    //Plot access to road
    mapPanel.addLayer(data['access_to_road'],{palette: ["ff0000"]},'Access to Road');
 
    //-Results
    graphPanel.clear();
    graphPanel.add(ui.Label('Results', {fontSize: '28px', color: 'blue'}));
    
    graphPanel.add(ui.Label(
      'Global Population Count in ' + defaultCountry + ' in ' + data['year'][0] + ': ',
      {fontSize: '14px'}));
    graphPanel.add(ui.Panel([ui.Label('* ' + (data['total_pop'][0]).toFixed(0) + '(GHSL Pop) ',
      {fontSize: '14px'}),
      ui.Label('* ' + (data['worldpop_total_pop'][0]).toFixed(0) + '(WorldPop) ',
      {fontSize: '14px'})]))
      
    graphPanel.add(ui.Panel([
      ui.Label((data['pop_within_dist'][0]).toFixed(0) + ' or ' +
      (data['RAI'][0]).toFixed(2) + '% live within ' + 
      (defaultDist2Road/1000) + 'km of a road.',{fontSize: '14px'})]));    
}

 
/****************************************************************************************
* Plot water area over time period
*****************************************************************************************/
var plotTrend = function(){

  var data = CalcRAI(availableYears, CountryCode);

  data.RAI = data.RAI.map(function(d){return d.getInfo()});
  data.total_pop = data.total_pop.map(function(d){return d.getInfo()});
  data.worldpop_total_pop = data.worldpop_total_pop.map(function(d){return d.getInfo()});
  data.pop_within_dist = data.pop_within_dist.map(function(d){return d.getInfo()});

  var RAIChart = ui.Chart.array.values(data.RAI, 0, availableYears)
      .setChartType('LineChart')
      .setSeriesNames(['RAI'])
      .setOptions({
        title: 'RAI Over Time',
        vAxis: {title: 'Population'},
        hAxis: {title: 'Year', gridlines: {count: 1}},
        interpolateNulls: true,
        pointSize: 1,
        lineWidth: 1,
      });
  graphPanel.widgets().set(1, RAIChart);

}

/****************************************************************************************
* Plot water area over time period
*****************************************************************************************/
var exportMap = function(){
  print('Generating Export Task for '+ defaultCountry + ' in ' + defaultYear)
  var image = (mapPanel.layers().get(0)).get('eeObject');

  Export.image.toDrive({
      image: image,
      folder: defaultCountry + '_' + defaultYear,
      description: 'Road_map_for_' + defaultCountry + '_in_' + defaultYear,
      scale: AreaScale,
      region: defaultLocation.polygon,
      maxPixels: 1e10,
      skipEmptyTiles: true,
      crs: EXPORT_CRS,
      fileFormat: 'GeoTIFF'
      });
}

/****************************************************************************************
* Define the pulldown menu.  Changing the pulldown menu changes the displayed year
*****************************************************************************************/
var yearSelect = ui.Select({
  items: availableYears,
  value: availableYears[0],
  onChange: function(year) {
    defaultYear = year;
    //DisplayPopLayer();
  }
});
/****************************************************************************************
* Define the pulldown menu.  Changing the pulldown menu changes the displayed location
*****************************************************************************************/
// Create the location pulldown.
var locations = Object.keys(locationDict);
var countrySelect = ui.Select({
  items: locations,
  value: locations[0],
  onChange: function(value) {
    var defaultLocation = locationDict[value];
    //
    defaultLocation.polygon = defaultLocation.polygon.getInfo();
    defaultLocation.lat = defaultLocation.lat.getInfo();
    defaultLocation.lon = defaultLocation.lon.getInfo();
    //
    defaultCountry = value;
    defaultLocation = location;
    //
    mapPanel.setCenter(defaultLocation.lon, defaultLocation.lat, defaultLocation.zoom);
    //DisplayPopLayer();
  }
});

var regionSelect = ui.Select({
  items: ['All'],
  value:'All',
  onChange: function(value) {
  }
});

// Add the select to the toolPanel with some explanatory text.
var yearPanel = ui.Panel([
  ui.Label( 'Select Year for displayed layer:', {'font-size': '12px'}), 
  yearSelect
],ui.Panel.Layout.flow('horizontal',true));

/****************************************************************************************
* Text box for the use of an asset file
*****************************************************************************************/
var asset_textbox = ui.Textbox({
  placeholder: 'ASSET name',
  style: {width: '200px'},
  onChange: function(text) {
    defaultAssetName = text;
    print('New asset to use ' + text );
    DisplayWaterLayer();
  }
});

var asset_LID_textbox = ui.Textbox({
  placeholder: 'Layer ID',
  style: {width: '50px'},
  onChange: function(text) {
    RegionID = Number(text);
    print('New Region ID:' + RegionID);    
    DisplayWaterLayer();
  }
});

var locationPanel = ui.Panel([
  ui.Label( 'Define Location:', {'font-size': '14px'}), 
  ui.Panel([countrySelect, regionSelect], ui.Panel.Layout.flow('horizontal',true))
],ui.Panel.Layout.flow('horizontal',true));

var assetPanel = ui.Panel([ui.Label( 'GEE ASSET:', {'font-size': '14px'}), asset_textbox, asset_LID_textbox],
  ui.Panel.Layout.flow('horizontal',true));
  
toolPanel.add(ui.Panel([yearPanel, locationPanel, assetPanel],ui.Panel.Layout.flow('vertical',true)));
yearSelect.setValue(defaultYear);


/****************************************************************************************
* Text box for the use of an asset file
*****************************************************************************************/

/*Road width*/
var RoadWidthSlider = ui.Select({
  items: ['2 km', '5 km'],
  value: '2 km',
  onChange: function(width) {
    if(width=='2 km'){
      defaultDist2Road = 2000.0;
    }else{
      defaultDist2Road = 5000.0;
    }
    //DisplayPopLayer();
  }
});

var DistPanel = ui.Panel([ui.Label( 'Distance to road:', {'font-size': '14px'}), RoadWidthSlider], 
  ui.Panel.Layout.Flow('horizontal'));
toolPanel.add(DistPanel);

// Create a visibility checkbox and an opacity slider.
//
// If the checkbox is clicked off, disable the layer pulldown and turn all the
// layers off. Otherwise, enable the select, and turn on the selected layer.
var checkbox = ui.Checkbox({
  label: 'Opacity',
  value: true,
  onChange: function(value) {
    var selected = layerSelect.getValue();
    // Loop through the layers in the mapPanel. For each layer,
    // if the layer's name is the same as the name selected in the layer
    // pulldown, set the visibility of the layer equal to the value of the
    // checkbox. Otherwise, set the visibility to false.
    mapPanel.layers().forEach(function(element, index) {
      element.setShown(selected == element.getName() ? value : false);
    });

    // If the checkbox is on, the layer pulldown should be enabled, otherwise,
    // it's disabled.
    layerSelect.setDisabled(!value);
  }
});

// Create an opacity slider. This tool will change the opacity for each layer.
// That way switching to a new layer will maintain the chosen opacity.
var opacitySlider = ui.Slider({
  min: 0,
  max: 1,
  value: 1,
  step: 0.01,
});
opacitySlider.onSlide(function(value) {
  mapPanel.layers().forEach(function(element, index) {
    element.setOpacity(value);
  });
});

var mailto = ui.Label(
    'Raymond Olympio, 2019', {},
    'mailto:rayoly@gmail.com');

var mailPanel = ui.Panel([mailto], 
    ui.Panel.Layout.Flow('horizontal'));
    
var viewPanel =
    ui.Panel([checkbox, opacitySlider], ui.Panel.Layout.Flow('horizontal'));
toolPanel.add(viewPanel);

var genMapBtn = ui.Button( 'Update Map', DisplayPopLayer, false, {fontWeight: 'bold'});  
var genGraphBtn = ui.Button( 'Generate Trend Graph', plotTrend, false, {fontWeight: 'bold', fontSize: '10px'});
var expMapBtn = ui.Button( 'Export Current Map', exportMap, false, {fontWeight: 'bold', fontSize: '10px'});

var trendPanel = ui.Panel([genMapBtn, genGraphBtn], 
    ui.Panel.Layout.Flow('horizontal'));
var exportPanel = ui.Panel([expMapBtn]);
toolPanel.add(trendPanel);
toolPanel.add(exportPanel);
toolPanel.add(mailPanel);
