//Raymond Olympio, 2019

/************************************************************************************
 * Configure layers and locations
 ************************************************************************************/
var AreaScale = 30;
//GSW dataset
var Y_WATER_DATASET_name = 'JRC/GSW1_0/YearlyHistory'
var M_WATER_DATASET_name = 'JRC/GSW1_0/MonthlyHistory';

//Use dataset USDOS LSIB 2017
var COUNTRY_DATASET = ee.FeatureCollection('USDOS/LSIB/2017');
//default values
var defaultCountry = 'Namibia';
var defaultYear = '1984';
var defaultMonth = 'All';
var defaultAssetName = '';
var defaultDB = 'GSW';
//date list
var availableYears = Array.apply(null, {length: 35}).map( function(number, index){return (1984+index).toString()});
var availableMonths = ['All','01','02','03','04','05','06','07','08','09','10','11','12'];
var availableDB = ['GSW','Sentinel NDWI'];
//CRS
var EXPORT_CRS = 'EPSG:4326';
var RegionID = 0;
/***********************************************************************************/

var layerProperties = {
  'Yearly': {
    name: 'Year',
    band: 'waterClass',
    min_data_value: 1,
    WATER_DATASET_name: Y_WATER_DATASET_name,
    trendSeries: ['Permanent', 'Seasonal','Permanent - Change','Seasonal - Change'],
    visParams: {min: 0, max: 3, palette: ['white', 'white', 'cyan', 'blue']},
    legend: [
      {'Permanent (GSW)': 'blue'}, {'Seasonal (GSW)': 'cyan'}
    ],
    defaultVisibility: true
  },
  'Monthly': {
    name: 'Month',
    band: 'water',
    min_data_value: 1,
    WATER_DATASET_name: M_WATER_DATASET_name,
    trendSeries: ['Water'],
    visParams: {min: 0, max: 2, palette: ['white', 'blue']},
    legend: [
      {'Water': 'blue'}, {'No Water': 'white'}
    ],
    defaultVisibility: true
  }
};
var defaultLayer = layerProperties['Yearly'];
// Some pre-set locations of interest that will be loaded into a pulldown menu.
var locationDict = {
  'Namibia': {lon: 18, lat: -22, zoom: 5, polygon: {}},
  'Botswana': {lon: 24, lat: -22, zoom: 5, polygon: {}}
};


/****************************************************************************************
* Internal variables and config
*****************************************************************************************/
var WATER_DATASET = ee.ImageCollection(defaultLayer.WATER_DATASET_name);
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
/****************************************************************************************
* 
*****************************************************************************************/
function Average(array){
  var avg = array.reduce(function(a, b) { return a + b; })/array.length;
  return avg;
}

/****************************************************************************************
* 
*****************************************************************************************/
function Average5(array, index){
  var tmparray = array.slice();
  var N = tmparray.length;
  while(N<=index+5){
    tmparray.push(0);
    N = N + 1;
  }
  var avg = Average(tmparray.slice(index,index+5));
  
  return avg;
}

/****************************************************************************************
* 
*****************************************************************************************/

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
var header = ui.Label('SDG 6.6.1: Water Change', {fontSize: '28px', color: 'blue'});
var subheader = ui.Label('Sub-Indicator 1', {fontSize: '24px', color: 'blue'});
var toolPanel = ui.Panel([header, subheader], 
    'flow', 
    {width: '400px'});

/*---------------------------------------------------------------------------------
* Create a map panel.
---------------------------------------------------------------------------------*/
var mapPanel = ui.Map();
// Take all tools off the map except the zoom and mapTypeControl tools.
mapPanel.setControlVisibility(
    {all: true, zoomControl: true, mapTypeControl: true});

defaultLocation.polygon = defaultLocation.polygon.getInfo();
defaultLocation.lat = defaultLocation.lat.getInfo();
defaultLocation.lon = defaultLocation.lon.getInfo();

mapPanel.setCenter(
    Number(defaultLocation.lon), 
    Number(defaultLocation.lat), 
    Number(defaultLocation.zoom) );

/*---------------------------------------------------------------------------------
* Create a plotting panel.
---------------------------------------------------------------------------------*/
var graphPanel = ui.Panel([],  'flow', {width: '300px', height: '200px', position: 'bottom-right' } );
graphPanel.add(ui.Label('Water Area Over Time', {fontWeight: 'bold'}))

/*---------------------------------------------------------------------------------
*  
---------------------------------------------------------------------------------*/
//mapPanel.style().position = 'middle-left';
mapPanel.add(graphPanel)
ui.root.widgets().reset([toolPanel, mapPanel]);

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
};

/****************************************************************************************
*
*****************************************************************************************/


/****************************************************************************************
* Display water layer for the selected year and region
*****************************************************************************************/
var DisplayWaterLayer = function(){
    loadingLabel.style().set('shown',true);
    var DateStart, DateEnd;
    var dataset, layer
    //clip region
    var poly = GetClippingPolygon();

    if(defaultDB=='GSW'){
      if(defaultMonth=='All'){
        DateStart = defaultYear + '-01-01';
        DateEnd = defaultYear + '-12-31';
  
        dataset = WATER_DATASET.filter(ee.Filter.date(DateStart, DateEnd));
      }else{
        
        dataset = WATER_DATASET
          .filterMetadata('year','equals',parseInt(defaultYear))
          .filterMetadata('month','equals',parseInt(defaultMonth));
      }
      var ImgWaterRegion = ee.Image(dataset.first())
        .select(defaultLayer.band);

    }else{
    //Calculate NDWI from Sentinel-2
      if(defaultMonth=='All'){
        DateStart = defaultYear + '-01-01';
        DateEnd = defaultYear + '-12-31';
        // Create an initial mosiac, which we'll visualize in a few different ways.
        var image = ee.ImageCollection('COPERNICUS/S2')
          .filterDate(DateStart, DateEnd)
          //.map(function(e) {return e.reduceResolution({reducer: ee.Reducer.mean(),maxPixels: 128 })})
          .median();
      }else{
        print('At the moment, Sentinel data can only be used for the full year.');
      }
      //only interested in water bodies --> NDWI>0.5 --> multiply by 4 to have same filtering as GSW
      print(image);
      print(image.bandNames());
      //NDWI: (B3-B8)/(B3+B8)
      //ImgWaterRegion = image.normalizedDifference(['B3', 'B8']).rename(['ndwi']).multiply(4);
      //NNDWI: (B3-B11)/(B3+B11)
      ImgWaterRegion = image.normalizedDifference(['B3', 'B11']).rename(['ndwi']).multiply(4);
    }

    print(ImgWaterRegion);
    ImgWaterRegion = ImgWaterRegion.clip(poly);
    
    //mask no data region
    if(defaultDB=='GSW'){
      ImgWaterRegion = ImgWaterRegion.updateMask(ImgWaterRegion.gt(defaultLayer.min_data_value));
    }else{
      //ImgWaterRegion = ImgWaterRegion.updateMask(ImgWaterRegion.lt(defaultLayer.min_data_value));
    }
    //Clear map panel
    if(mapPanel.layers().length()>=1){
      var maplayer = mapPanel.layers();
      mapPanel.remove(maplayer.get(0)) 
    }
    //
    var gridOutlines = ee.Image().toByte().paint(ee.Feature(poly), 'red', 2); 
    //Clean
    if(mapPanel.layers().length()>1){
      mapPanel.remove(mapPanel.layers().get(0));
      mapPanel.remove(mapPanel.layers().get(0));
    }else if(mapPanel.layers().length()>0){
      mapPanel.remove(mapPanel.layers().get(0));
    }
    //
    mapPanel.add(ui.Map.Layer(gridOutlines, {}, 'Region'));
    mapPanel.add(ui.Map.Layer(ImgWaterRegion, 
      defaultLayer.visParams, 
      defaultLayer.name + '_' + defaultYear + '-' + defaultMonth, 
      defaultLayer.defaultVisibility));
    
    loadingLabel.style().set('shown',false);
}

/****************************************************************************************
* Extract water area
*****************************************************************************************/
var waterCount = function(image, geometry, WATER_TYPE){
  var AreaScale = 30.0;
  image = ee.Image(image);
  var water03 = image.eq(WATER_TYPE);
  var area = ee.Image.pixelArea();
  var waterArea = water03.multiply(area).rename('waterArea');

  var stats = waterArea.reduceRegion({
      reducer: ee.Reducer.sum(), 
      geometry: geometry, 
      scale: AreaScale,
      maxPixels: 1e12
    });
  var StrArea = stats.get('waterArea');
  return StrArea;
};


/****************************************************************************************
* Extract water area
*****************************************************************************************/
var CalcWaterArea = function(){
    var data = {date: [], area2: [], area3: [], pctchange2:[], pctchange3:[]}; 
    
    var LstArea2 = ee.List([]);
    var LstArea3 = ee.List([]);
    var LstDate =  ee.List([]);
    var DateStart, DateEnd, yearRange, monthRange, bandname;
    //
    var dataset = WATER_DATASET;
    if(defaultMonth=='All'){
      print('Calculating trend all the Years');
      bandname = 'waterClass';
      yearRange = availableYears;
      monthRange = ['All'];
    }else{
      print('Calculating trend for the Year ' + defaultYear);
      bandname = 'water';
      yearRange = [defaultYear];
      monthRange = availableMonths.slice(1,13);
    }
    //
    //Define clipping polygon
    var poly = GetClippingPolygon()
    //
    dataset = dataset.map(function(f) {return f.select(bandname).clip(poly)});

    var ImgWaterRegion;
    for(var i=0;i<yearRange.length;i++){
      for(var j=0;j<monthRange.length;j++){
       
        if(monthRange[j]=='All'){
          DateStart = yearRange[i] + '-01-01';
          DateEnd = yearRange[i] + '-12-31';
          LstDate = LstDate.add( yearRange[i] );
          ImgWaterRegion = ee.Image(dataset
            .filter(ee.Filter.date(DateStart, DateEnd))
            .first());
        }else{
          LstDate = LstDate.add( yearRange[i] + '-' + monthRange[j] );
          ImgWaterRegion = ee.Image(dataset
            .filterMetadata('year','equals',parseInt(yearRange[i]))
            .filterMetadata('month','equals',parseInt(monthRange[j]))
            .first());
        }
      
        var area3 = ee.Number(waterCount(ImgWaterRegion, defaultLocation.polygon, 3)).divide(1e6);
        var area2 = ee.Number(waterCount(ImgWaterRegion, defaultLocation.polygon, 2)).divide(1e6);
        LstArea3 = LstArea3.add(area3);
        LstArea2 = LstArea2.add(area2);
      }
    }
    //
    data.area3 = LstArea3.getInfo();
    data.area2 = LstArea2.getInfo();
    data.date = LstDate.getInfo();

    //5-year average
    if(monthRange.length==1){
      var gamma2, gamma3;
      var beta3 = Average5(data['area3'], 2001-1984);
      var beta2 = Average5(data['area2'], 2001-1984);      
      for(i=0;i<data['area3'].length;i++){
          gamma2 = Average5(data['area2'],i);
          gamma3 = Average5(data['area3'],i);
          data['pctchange2'].push( (beta2-gamma2)/beta2*100 );
          data['pctchange3'].push( (beta3-gamma3)/beta3*100 );
      }
    }
    return data;
}

/****************************************************************************************
* Plot water area over time period
*****************************************************************************************/
var plotTrend = function(){
  genGraphBtn.setLabel('Calculating...');
  
  var data = CalcWaterArea();
  var areas;
  var title;
  var year_range = data['date'];
  if(defaultLayer.name=='Year'){
    areas = [data['area3'], data['area2'], data['pctchange2'], data['pctchange3']];
  }else{
    areas = [data['area3'], [], [], []];
  }

  if(defaultAssetName.length>0){
    title = 'Water Area Over Time over ' + defaultAssetName + 
        ' during '+ defaultYear + '/' + defaultMonth;
  }else{
    title = 'Water Area Over Time over ' + defaultCountry + '.' + RegionID + 
        ' during '+ defaultYear + '/' + defaultMonth;
  }

  var waterChart = ui.Chart.array.values(areas, 1, year_range)
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
          1: {targetAxisIndex: 0},
          2: {targetAxisIndex: 1},
          3: {targetAxisIndex: 1}
        }        
      });
  graphPanel.widgets().set(0, waterChart);
  genGraphBtn.setLabel('Generate Trend Graph');
}

/****************************************************************************************
* Plot water area over time period
*****************************************************************************************/
var exportMap = function(){
  print('Generating Export Task for '+ defaultCountry + ' in ' + defaultYear + '.' + defaultMonth)
  var image = (mapPanel.layers().get(1)).get('eeObject');
  /*var layers = mapPanel.layers();
  var imageLst = ee.List([]);
  layers.forEach(function(i) {imageLst = imageLst.add(i.get('eeObject'))});
  var image = ee.FeatureCollection(imageLst);*/
  
  var poly = GetClippingPolygon();
  Export.image.toDrive({
      image: image,
      description: 'Water_map_for_' + RegionID + '_' + defaultYear + '-' + defaultMonth,
      scale: AreaScale,
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
  items: availableYears,
  value: availableYears[1],
  onChange: function(year) {
    defaultYear = year;
    //DisplayWaterLayer();
  }
});
var monthSelect = ui.Select({
  items: availableMonths,
  value: availableMonths[0],
  onChange: function(month) {
    if(month=='All'){
      WATER_DATASET = ee.ImageCollection(Y_WATER_DATASET_name);
      defaultLayer = layerProperties['Yearly'];
      
    }else{
      WATER_DATASET = ee.ImageCollection(M_WATER_DATASET_name);
      defaultLayer = layerProperties['Monthly'];
    }
    defaultMonth = month;
    setLegend(defaultLayer.legend);
    //DisplayWaterLayer();
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
    defaultLocation = locationDict[value];
    defaultCountry = value;
    //
    defaultLocation.polygon = defaultLocation.polygon.getInfo();
    defaultLocation.lat = defaultLocation.lat.getInfo();
    defaultLocation.lon = defaultLocation.lon.getInfo();

    //Update center of map
    mapPanel.setCenter(defaultLocation.lon, defaultLocation.lat, defaultLocation.zoom);
    //Display layers
    //DisplayWaterLayer();
  }
});

var regionSelect = ui.Select({
  items: ['All'],
  value:'All',
  onChange: function(value) {
  }
});

var DBSelect = ui.Select({
  items: availableDB,
  value: defaultDB,
  onChange: function(value) {
    defaultDB = value;
  }
});    
var DBPanel = ui.Panel([
  ui.Label('Dataset:', {fontWeight: 'bold', fontSize: '14px'}), 
  DBSelect], 
  ui.Panel.Layout.flow('horizontal',true));
// Add the select to the toolPanel with some explanatory text.
var yearPanel = ui.Panel([
  ui.Label( 'Year and Month for displayed layer:', {fontWeight: 'bold','font-size': '14px'}), 
  yearSelect, monthSelect],
  ui.Panel.Layout.flow('horizontal',true));


/****************************************************************************************
* Text box for the use of an asset file
*****************************************************************************************/
var asset_textbox = ui.Textbox({
  placeholder: 'users/.../',
  style: {width: '200px'},
  onChange: function(text) {
    loadingLabel.style().set('shown',true);

    defaultAssetName = text;
    print('New asset to use ' + text );
    //DisplayWaterLayer();
    loadingLabel.style().set('shown',false);

    /*if(defaultAssetName.length>0){
      active_gee_asset.setValue(true);    
      active_preshape.setValue(false);
    }else{
      
      active_gee_asset.setValue(false);    
      active_preshape.setValue(true);
    }*/
  }
});

var asset_LID_textbox = ui.Textbox({
  placeholder: 'Layer ID',
  style: {width: '50px'},
  onChange: function(text) {
    loadingLabel.set('shown',true);
    
    active_preshape.setValue(false);
    active_gee_asset.setValue(true);
    
    RegionID = Number(text);
    print('New Region ID:' + RegionID);    
    //DisplayWaterLayer();
    loadingLabel.set('shown',false);
  }
});

var active_preshape = ui.Checkbox('Define Location:', true, {fontWeight: 'bold', 'font-size': '14px'});
active_preshape.setDisabled(true);
var locationPanel = ui.Panel([
  active_preshape,
  ui.Panel([countrySelect, regionSelect], ui.Panel.Layout.flow('horizontal',true))
],ui.Panel.Layout.flow('horizontal',true));

var loadingLabel = ui.Label({
      value: 'Loading...',
      style: {stretch: 'vertical', color: 'gray', shown: false}
    })
    
    
var active_gee_asset = ui.Checkbox('GEE ASSET Shapefile:', false, {fontWeight: 'bold', 'font-size': '14px'});
active_gee_asset.setDisabled(true);
var assetPanel = ui.Panel([
    active_gee_asset, 
    ui.Panel([asset_textbox, asset_LID_textbox, loadingLabel],ui.Panel.Layout.flow('horizontal',true))
  ],
  'flow');

toolPanel.add(ui.Panel([DBPanel, yearPanel, locationPanel, assetPanel],ui.Panel.Layout.flow('vertical',true)));
yearSelect.setValue(availableYears[0]);


// Create the legend.
// Define a panel for the legend and give it a tile.
var legendPanel = ui.Panel({
  style:
      {
        fontWeight: 'bold', 
        fontSize: '10px', 
        margin: '0 0 0 8px', 
        padding: '0',
        width: '150px',
        position: 'bottom-left'
      }
});
mapPanel.add(legendPanel);

var legendTitle = ui.Label(
    'Legend',
    {fontWeight: 'bold', fontSize: '10px', margin: '0 0 4px 0', padding: '0'});
legendPanel.add(legendTitle);

// Define an area for the legend key itself.
// This area will be replaced every time the layer pulldown is changed.
var keyPanel = ui.Panel();
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
    var description = ui.Label(name, {margin: '0 0 4px 6px'});
    keyPanel.add(
        ui.Panel([colorBox, description], ui.Panel.Layout.Flow('horizontal')));
  }
}

// Set the initial legend.
setLegend(defaultLayer.legend);

// Create a visibility checkbox and an opacity slider.
//
// If the checkbox is clicked off, disable the layer pulldown and turn all the
// layers off. Otherwise, enable the select, and turn on the selected layer.
var checkbox = ui.Checkbox({
  label: 'Layer Opacity',
  value: true,
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
    ui.Panel([checkbox, opacitySlider], 
    ui.Panel.Layout.Flow('horizontal'));


var genGraphBtn = ui.Button( 'Generate Trend Graph', 
  plotTrend, false, {fontWeight: 'bold'});
var genMapBtn = ui.Button( 'Update Map', 
  DisplayWaterLayer, false, {fontWeight: 'bold'});  
var expMapBtn = ui.Button( 'Export Current Map', 
  exportMap, false, {fontWeight: 'bold'});

var trendPanel = ui.Panel([genMapBtn, genGraphBtn], 
    ui.Panel.Layout.Flow('horizontal'));
var exportPanel = ui.Panel([expMapBtn]);
toolPanel.add(trendPanel);
toolPanel.add(exportPanel);

toolPanel.add(viewPanel);
toolPanel.add(mailPanel);

/*---------------------------------------------------------------------------------
*  
---------------------------------------------------------------------------------*/
// Create a hyperlink to an external reference.
var link = ui.Label(
    'GSW dataset: J.-F. Pekel, A. Cottam, N. Gorelick, A. S. Belward, "High-resolution mapping of global surface water and its long-term changes." Nature 540, 418-422 (2016).', {},
    'https://www.nature.com/articles/nature20584');
var sentinel_info = ui.Label('Copernicus/Sentinel-2 data available from Jun 23, 2015 - ');
var linkPanel = ui.Panel(
    [ui.Label('For more information', {fontWeight: 'bold'}), link, sentinel_info]);
toolPanel.add(linkPanel);
