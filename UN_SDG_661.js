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

/************************************************************************************
 * Configure GUI
 ************************************************************************************/
var TEXTCOLOR = '#44546A';//Text color
var BACKCOLOR = '#EEEEEE';//Background color
var PANEL_STYLE = {width: '400px', color:TEXTCOLOR, backgroundColor: BACKCOLOR};

var TITLE_STYLE = {position: 'top-right', fontWeight: 'normal', fontSize: '28px', color:TEXTCOLOR, backgroundColor: BACKCOLOR};
var SUBTITLE_STYLE = {position: 'top-right', fontWeight: 'normal', fontSize: '24px', color:TEXTCOLOR, backgroundColor: BACKCOLOR};

var BUTTON_STYLE =   {position: 'middle-left', margin:'0px 4px 4px 4px', fontWeight: 'bold', 'font-size': '14px', color:TEXTCOLOR, backgroundColor: BACKCOLOR};
var HELP_BTN_SYTLE = {position: 'middle-left', margin:'0px 4px 4px 4px', padding: '0px',  
        textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color:'green', backgroundColor: BACKCOLOR};
var LABEL_STYLE = {position: 'middle-left', margin:'4px 4px 4px 4px', fontWeight: 'normal', fontSize: '14px', color:TEXTCOLOR, backgroundColor: BACKCOLOR};
var LABEL_T_STYLE = {position: 'middle-left', margin:'4px 4px 4px 4px', fontWeight: 'bold', fontSize: '14px', color:TEXTCOLOR, backgroundColor: BACKCOLOR};

var CKBOX_STYLE  = {position: 'middle-left', margin:'4px 4px 4px 4px', fontWeight: 'normal', 'font-size': '14px', color:TEXTCOLOR, backgroundColor: BACKCOLOR};
var SLIDER_STYLE = {position: 'middle-left', margin:'4px 4px 4px 4px', fontWeight: 'bold',   'font-size': '14px', color:TEXTCOLOR, backgroundColor: BACKCOLOR};
var SELECT_STYLE = {position: 'middle-left', margin:'0px 4px 4px 4px', fontWeight: 'bold',   'font-size': '14px', color:TEXTCOLOR, backgroundColor: BACKCOLOR};
var EDIT_STYLE = {position: 'middle-left', margin:'0px 4px 4px 4px', fontWeight: 'bold',   'font-size': '14px', color:TEXTCOLOR, backgroundColor: BACKCOLOR};

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
var defaultYear = '1984';
var defaultMonth = 'All';
var defaultAssetName = '';
var defaultDB = 'GSW';
var rangeType = 'Yearly';
//date list
var availableMonths = ['All','01','02','03','04','05','06','07','08','09','10','11','12'];
var availableDB = ['GSW','S2'];
//CRS
var EXPORT_CRS = 'EPSG:4326';
var RegionID = 0;
/***********************************************************************************/

var layerProperties = {
  'GSW':{
    'Yearly': {
      name: 'Year',
      band: 'waterClass',
      min_data_value: 1,
      WATER_DATASET_name: 'JRC/GSW1_0/YearlyHistory',
      AreaScale: 30.0,
      availableYears: Array.apply(null, {length: 32}).map( function(number, index){return (1984+index).toString()}),
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
      availableYears: Array.apply(null, {length: 32}).map( function(number, index){return (1984+index).toString()}),
      WATER_DATASET_name: 'JRC/GSW1_0/MonthlyHistory',
      AreaScale: 30.0,
      trendSeries: ['Water'],
      visParams: {min: 0, max: 2, palette: ['white', 'blue']},
      legend: [
        {'Water': 'blue'}, {'No Water': 'white'}
      ],
      defaultVisibility: true
    }
  },
  'S2':{
    'Yearly': {
      name: 'Year',
      band: 'water',
      min_data_value: 1,
      availableYears: Array.apply(null, {length: 4}).map( function(number, index){return (2015+index).toString()}),
      WATER_DATASET_name: 'COPERNICUS/S2',
      AreaScale: 30.0,
      trendSeries: ['Water', 'Change'],
      visParams: {min: 0, max: 3},
      legend: [
        {'NDWI(Gao)': 'red'}, {'NDWI(McFeeters)': 'green'}, {'water': 'blue'}
      ],
      defaultVisibility: true
    },
    'Monthly': {
      name: 'Month',
      band: 'water',
      min_data_value: 1,
      availableYears: Array.apply(null, {length: 4}).map( function(number, index){return (2015+index).toString()}),
      WATER_DATASET_name: 'COPERNICUS/S2',
      AreaScale: 30.0,
      trendSeries: ['Water'],
      visParams: {min: 0, max: 3},
      legend: [
        {'NDWI (Gao)': 'red'}, {'NDWI (McFeeters)': 'green'}, {'water': 'blue'}
      ],
      defaultVisibility: true
    }
  }
};
var defaultLayer = layerProperties[defaultDB]['Yearly'];
// Some pre-set locations of interest that will be loaded into a pulldown menu.
var locationDict = {
  'Namibia': {lon: 18, lat: -22, zoom: 5, polygon: {}},
  'Botswana': {lon: 24, lat: -22, zoom: 5, polygon: {}}
};


/****************************************************************************************
* Internal variables and config
*****************************************************************************************/
var WATER_DATASET;
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
* 
*****************************************************************************************/
var help_text = ui.Label({
  value: '-------------------------------------------\n'+
  'This App can be used to evaluate the trend in water and evaluate UN SDG Indicator 6.6.1\n' + 
  '-------------------------------------------\n'+
  'The software is provided "AS IS", without warranty of any king, express or ' +
  'implied, including but not limited to the warranties of merchantability, ' +
  'fitness for a particular purpose and noninfringement. In no event shall the ' +
  'authors or copyright holders be liable for any claim, damages or other ' +
  'liability, whether in an action of contract, tort or otherwuse, arising from, ' +
  'out of or in connection with the software or the use or other dealings in the ' +
  'software.',
  style: {position: 'middle-left', margin:'40px 4px 4px 4px', padding:'0px', 
  width: '350px', whiteSpace: 'pre-wrap', color:'#44546A', backgroundColor: '#DDDDDD'}});
var help_quit = ui.Button({label: 'X',style: {position: 'top-right', color: 'red', backgroundColor: '#DDDDDD'}});
var help_panel = ui.Panel({
  layout: ui.Panel.Layout.absolute(),
  widgets: [help_quit, help_text],
  style: {width: '450px', height: '150px', color:'#44546A', backgroundColor: '#DDDDDD'}
});

function show_help_panel(text) {
  help_panel.style().set('shown', true);
  help_text.setValue(text);
  help_panel.style().set({margin:'4px 4px 4px 4px'});
}
help_quit.onClick( function() {help_panel.style().set('shown', false); });
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
var header = ui.Label('SDG 6.6.1: Water Change', TITLE_STYLE);
var subheader = ui.Label('Sub-Indicator 1', SUBTITLE_STYLE);
var toolPanel = ui.Panel([header, subheader], 'flow', PANEL_STYLE);

/*---------------------------------------------------------------------------------
* Create a map panel.
---------------------------------------------------------------------------------*/
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

/*---------------------------------------------------------------------------------
* Create a plotting panel.
---------------------------------------------------------------------------------*/
var graphPanel = ui.Panel([],  'flow', 
  {border: '1px solid black', width: '300px', height: '200px', position: 'bottom-right' } );
graphPanel.add(ui.Label('Water Area Over Time', {fontWeight: 'bold', color:TEXTCOLOR}))

/*---------------------------------------------------------------------------------
*  
---------------------------------------------------------------------------------*/
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
  //Generate water layer(s) based on Global surface water dataset or S2 data
  var ImgWaterRegion;
  if(defaultDB=='GSW'){
    ImgWaterRegion = DisplayWaterLayer_GSW();
  }else{
    ImgWaterRegion = DisplayWaterLayer_S2(defaultDB);
  }
  
  //Clear map panel
  while(mapPanel.layers().length()>0){
    mapPanel.remove(mapPanel.layers().get(0));
  }    
  
  //Define region outline
  var poly = GetClippingPolygon();
  var gridOutlines = ee.Image().toByte().paint(ee.Feature(poly), 'red', 2); 
  
  //plot outline
  mapPanel.add(ui.Map.Layer(gridOutlines, {}, 'Region'));
  
  //plot water layer
  mapPanel.add(ui.Map.Layer(ImgWaterRegion, 
    defaultLayer.visParams, 
    defaultLayer.name + '_' + defaultYear + '-' + defaultMonth, 
    defaultLayer.defaultVisibility));
  //Calculate water extent
  if(defaultDB=='GSW'){
    var area3 = ee.Number(waterCount(ImgWaterRegion.select(defaultLayer.band), defaultLocation.polygon, defaultLayer.AreaScale, 3)).divide(1e6);
    var area2 = ee.Number(waterCount(ImgWaterRegion.select(defaultLayer.band), defaultLocation.polygon, defaultLayer.AreaScale, 2)).divide(1e6);
    //
    var waterInfo = ui.Label('Extent of water during ' + defaultYear +  '/' + defaultMonth + ' [' + defaultDB + ']:\n'
          + '*Permanent='+area3.getInfo().toFixed(1)+'km2\n'
          + '*Seasonal='+area2.getInfo().toFixed(1)+'km2',  
    {fontWeight: 'bold', color:TEXTCOLOR})
    graphPanel.widgets().set(1, waterInfo);
  }
  //
  loadingLabel.style().set('shown',false);
}
//---------------------------------------------------------------------------------------
var DisplayWaterLayer_GSW = function(){
  var DateStart, DateEnd;
  var dataset, layer;
  
  if(defaultYear<defaultLayer.availableYears[0] || defaultYear>defaultLayer.availableYears[-1]){
    show_help_panel('Year ' + defaultYear + ' is not available for the current dataset: ' + defaultDB);
    return;
  }
  
  //clip region
  var poly = GetClippingPolygon();
  //load data
  WATER_DATASET = ee.ImageCollection(defaultLayer.WATER_DATASET_name);
  //filter data by date
  if(defaultMonth=='All'){
    DateStart = defaultYear + '-01-01';
    DateEnd = defaultYear + '-12-31';
    dataset = WATER_DATASET.filter(ee.Filter.date(DateStart, DateEnd));
  }else{
    dataset = WATER_DATASET
      .filterMetadata('year','equals',parseInt(defaultYear))
      .filterMetadata('month','equals',parseInt(defaultMonth));
  }
  //
  var ImgWaterRegion = ee.Image(dataset.first()).select(defaultLayer.band);

  ImgWaterRegion = ee.Image(ImgWaterRegion).clip(poly);
  
  //mask no data region
  ImgWaterRegion = ImgWaterRegion.updateMask(ImgWaterRegion.gt(defaultLayer.min_data_value));

  return ImgWaterRegion;
}
//---------------------------------------------------------------------------------------
var DisplayWaterLayer_S2 = function(S2_DWI_type){
  var DateStart, DateEnd;
  var dataset, layer
  //clip region
  var poly = GetClippingPolygon();
  if(defaultYear<defaultLayer.availableYears[0] || defaultYear>defaultLayer.availableYears[-1]){
    show_help_panel('Year ' + defaultYear + ' is not available for the current dataset: ' + defaultDB);
    return;
  }
  //Calculate NDWI from Sentinel-2
  if(defaultMonth=='All'){
    DateStart = defaultYear + '-01-01';
    DateEnd = defaultYear + '-12-31';
  }else{
    DateStart = defaultYear + '-' + defaultMonth + '-01';
    DateEnd = defaultYear + '-' + defaultMonth + '-31';
    show_help_panel('At the moment, Sentinel data can only be used for the full year.');
  }
  // Create an initial mosiac, which we'll visualize in a few different ways.
  var image = ee.ImageCollection(defaultLayer.WATER_DATASET_name)
    .filterDate(DateStart, DateEnd)
    .select(['B3','B8','B11'])
    .map(function(img) {return img.clip(poly);})
    //.map(function(e) {return e.reduceResolution({reducer: ee.Reducer.mean(),maxPixels: 128 })})
    .median();

  //only interested in water bodies --> NDWI>0.5 --> multiply by 4 to have same filtering as GSW
  var ImgWaterRegion;
	//NDWI: (B3-B8)/(B3+B8) // (NIR-SWIR)/(NIR+SWIR) -- ref
	ImgWaterRegion = image.normalizedDifference(['B3', 'B8']).rename(['ndwi_Gao']);
	//NNDWI: (B3-B11)/(B3+B11) // (Green-NIR)(Green + NIR)
	ImgWaterRegion = ImgWaterRegion.addBands(image.normalizedDifference(['B3', 'B11']).rename(['ndwi_McFeeters']), null, false);
  
  //var mndwi = i.normalizedDifference(['green', 'MIR']).rename('MNDWI');
  
  //water mask as for GSW
  ImgWaterRegion = ImgWaterRegion.addBands(
    ImgWaterRegion.expression("abs(gao)>= 1.0 || abs(mfc)>= 0.3", {
      gao: ImgWaterRegion.select('ndwi_Gao'),
      mfc: ImgWaterRegion.select('ndwi_McFeeters')
    })
    .multiply(ee.Image.constant(3.0))
    .rename('water'), ['water'], false);
  
  ImgWaterRegion = ImgWaterRegion.selfMask();
  //
  return ImgWaterRegion;
}

/****************************************************************************************
* Extract water area
*****************************************************************************************/
var waterCount = function(image, geometry, AreaScale, WATER_TYPE){
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
    //Output data
    var data = {date: [], area2: [], area3: [], pctchange2:[], pctchange3:[]}; 
    //    
    var LstArea2 = ee.List([]);
    var LstArea3 = ee.List([]);
    var LstDate =  ee.List([]);
    var DateStart, DateEnd, yearRange, monthRange;
    var ImgWaterRegion;
    //
    var defaultLayer0 = defaultLayer;
    var defaultYear0 = defaultYear;
    var defaultMonth0 = defaultMonth;
    //
    if(rangeType=='Yearly'){
      show_help_panel('Trend over all the years');
      //define layer to use
      defaultLayer = layerProperties[defaultDB]['Yearly'];
      //Years and months to consider
      yearRange = defaultLayer.availableYears;
      monthRange = ['All'];
    }else{
      show_help_panel('Trend for the year ' + defaultYear);
      //define layer to use
      defaultLayer = layerProperties[defaultDB]['Monthly'];
      //Years and months to consider
      yearRange = [defaultYear];
      monthRange = availableMonths.slice(1,13);
    }
    //LOOP
    for(var i=0;i<yearRange.length;i++){
      for(var j=0;j<monthRange.length;j++){
       
        defaultYear = yearRange[i];
        defaultMonth = monthRange[j];

        //
        if(defaultDB=='GSW'){
          ImgWaterRegion = DisplayWaterLayer_GSW();
        }else{
          ImgWaterRegion = DisplayWaterLayer_S2(defaultDB);
        }       
        //Select band to use
        ImgWaterRegion
        ImgWaterRegion = ImgWaterRegion.select(defaultLayer.band);
        ImgWaterRegion
        //Save current time point
        if(monthRange[j]=='All'){
          LstDate = LstDate.add( yearRange[i] );
        }else{
          LstDate = LstDate.add( yearRange[i] + '-' + monthRange[j] );
        }
        //----------------------------------------------------------------------------------------
        var area3 = ee.Number(waterCount(ImgWaterRegion, defaultLocation.polygon, defaultLayer.AreaScale, 3)).divide(1e6);
        var area2 = ee.Number(waterCount(ImgWaterRegion, defaultLocation.polygon, defaultLayer.AreaScale, 2)).divide(1e6);
          
        LstArea3 = LstArea3.add(area3);
        LstArea2 = LstArea2.add(area2);
      }
    }
    defaultYear = defaultYear0;
    defaultMonth = defaultMonth0;
    defaultLayer = defaultLayer0;
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

  if(defaultLayer.name=='Year' && defaultLayer.trendSeries.length==4){
    areas = [data['area3'], data['area2'], data['pctchange2'], data['pctchange3']];
  }else if(defaultLayer.name=='Year' && length(defaultLayer.trendSeries)==2){
    areas = [data['area3'], [], data['pctchange2'], []];
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
  graphPanel.widgets().set(1, waterChart);
  genGraphBtn.setLabel('Generate Trend Graph');
}

/****************************************************************************************
* Plot water area over time period
*****************************************************************************************/
var exportMap = function(){
  show_help_panel('Generating Export Task for '+ defaultCountry + ' in ' + defaultYear + '.' + defaultMonth)
  var image = (mapPanel.layers().get(1)).get('eeObject');

  var poly = GetClippingPolygon();
  Export.image.toDrive({
      image: image,
      description: 'Water_map_for_' + RegionID + '_' + defaultYear + '-' + defaultMonth,
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
  items: defaultLayer.availableYears,
  value: defaultLayer.availableYears[1],
  style: SELECT_STYLE,
  onChange: function(year) {
    defaultYear = year;
  }
});
var monthSelect = ui.Select({
  items: availableMonths,
  value: availableMonths[0],
  style: SELECT_STYLE,
  onChange: function(month) {
    defaultMonth = month;
    if(defaultMonth=='All'){
      defaultLayer = layerProperties[defaultDB]['Yearly'];
    }else{
      defaultLayer = layerProperties[defaultDB]['Monthly'];
    }
    setLegend(defaultLayer.legend);
  }
});
/****************************************************************************************
* Define the pulldown menu.  Changing the pulldown menu changes the displayed location
*****************************************************************************************/
// Create the location pulldown.
var locations = Object.keys(locationDict);
var index = locations.sort().indexOf("Namibia")

var countrySelect = ui.Select({
  items: locations.sort(),
  value: locations[index],
  style: SELECT_STYLE,
  onChange: function(value) {
    defaultLocation = locationDict[value];
    defaultCountry = value;
    //
    defaultLocation.polygon = defaultLocation.polygon.getInfo();
    defaultLocation.lat = defaultLocation.lat.getInfo();
    defaultLocation.lon = defaultLocation.lon.getInfo();

    //Update center of map
    mapPanel.setCenter(defaultLocation.lon, defaultLocation.lat, defaultLocation.zoom);
  }
});

var regionSelect = ui.Select({
  items: ['All'],
  value:'All',
  style: SELECT_STYLE,
  onChange: function(value) {
  }
});

var DBSelect = ui.Select({
  items: availableDB,
  value: defaultDB,
  style: SELECT_STYLE,
  onChange: function(value) {
    defaultDB = value;
    //update layer prop
    if(defaultMonth=='All'){
      defaultLayer = layerProperties[defaultDB]['Yearly'];
    }else{
      defaultLayer = layerProperties[defaultDB]['Monthly'];
    }
    //Update year drop down
    yearSelect.setValue(defaultLayer.availableYears[0]);
    //Update legend
    setLegend(defaultLayer.legend);
  }
});    
var DBPanel = ui.Panel([ui.Label('Dataset:', LABEL_T_STYLE),   DBSelect,
  ui.Button('?',  function() {show_help_panel(['GSW: Global Surface Water.\nS2: Sentinel data used to calculate NDWI.'
  + '\nDue to the complexity of accurately detecting water over long timeframes,'
  + ' it is recommended to use GSW.'])}, false, HELP_BTN_SYTLE)], 
  ui.Panel.Layout.flow('horizontal',true), PANEL_STYLE);
// Add the select to the toolPanel with some explanatory text.
var yearPanel = ui.Panel([
  ui.Label( 'Year and Month for displayed layer:', LABEL_T_STYLE), 
  yearSelect, monthSelect],
  ui.Panel.Layout.flow('horizontal',true), PANEL_STYLE);


/****************************************************************************************
* Text box for the use of an asset file
*****************************************************************************************/
EDIT_STYLE.width = '200px';
var asset_textbox = ui.Textbox({
  placeholder: 'users/.../',
  style: EDIT_STYLE,
  onChange: function(text) {
    defaultAssetName = text;
    show_help_panel('New asset to use ' + defaultAssetName );
  }
});

EDIT_STYLE.width = '50px';
var asset_LID_textbox = ui.Textbox({
  placeholder: 'Layer ID',
  style: EDIT_STYLE,
  onChange: function(text) {
    active_preshape.setValue(false);
    active_gee_asset.setValue(true);
    RegionID = Number(text);
    show_help_panel('New Region ID:' + RegionID);    
  }
});

//------------------------ Selection of a predefined shape 
var helppreshape = ui.Button('?',  
function() {show_help_panel('Select the Region Of Interest, based on USDOS LSIB. Regional levels and below are not available yet.')}, 
false, HELP_BTN_SYTLE);
var active_preshape = ui.Checkbox( {label:'Predefined:', value: true, style: CKBOX_STYLE} );
active_preshape.setDisabled(true);
var predefLocPanel = ui.Panel( [active_preshape,countrySelect, regionSelect,helppreshape],
  ui.Panel.Layout.flow('horizontal',true), PANEL_STYLE);

var helpgeeasset = ui.Button('?',  function() {show_help_panel('Select a region from your GEE ASSETS with the defined layer ID.')}, false, HELP_BTN_SYTLE);
var active_gee_asset = ui.Checkbox( {label:'GEE ASSET Shapefile:', value: false, style: CKBOX_STYLE} );
active_gee_asset.setDisabled(true);
var loadingLabel = ui.Label({
      value: 'Loading...',
      style: {stretch: 'vertical', color: 'gray', shown: false, backgroundColor: BACKCOLOR}
    })
var assetPanel = ui.Panel([
    active_gee_asset, 
    ui.Panel([asset_textbox, asset_LID_textbox, helpgeeasset, loadingLabel],ui.Panel.Layout.flow('horizontal',true),PANEL_STYLE)
  ],
  'flow', PANEL_STYLE);

var LocationPanel = ui.Panel([ui.Label( 'Location:', LABEL_T_STYLE),  predefLocPanel, assetPanel], 'flow', PANEL_STYLE);

toolPanel.add(ui.Panel([DBPanel, yearPanel, LocationPanel],ui.Panel.Layout.flow('vertical',true)));
yearSelect.setValue(defaultLayer.availableYears[0]);


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
  style: CKBOX_STYLE,
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
  style: SLIDER_STYLE
});
opacitySlider.onSlide(function(value) {
  mapPanel.layers().forEach(function(element, index) {
    element.setOpacity(value);
  });
});

var mailPanel = ui.Panel([ui.Label('Raymond Olympio, 2019', {backgroundColor: BACKCOLOR}, 'mailto:rayoly@gmail.com')], 
  ui.Panel.Layout.Flow('horizontal'), PANEL_STYLE);
var viewPanel = ui.Panel([checkbox, opacitySlider], ui.Panel.Layout.Flow('horizontal'), PANEL_STYLE);

//-------------------------------------------------------------
var helpmap = ui.Button('?',
  function() {show_help_panel('Update the map with the water layer calculated from the selected dataset, year and month. When Month="All", the yearly average is displayed.')},
  false, HELP_BTN_SYTLE);
var genMapBtn = ui.Button( 'Update Map', DisplayWaterLayer, false, BUTTON_STYLE);
var mapCntrl = ui.Panel([genMapBtn, helpmap],ui.Panel.Layout.Flow('horizontal'), PANEL_STYLE);
//-------------------------------------------------------------  
var rangeTypeSelect = ui.Select({
  items: ['Yearly','Monthly'],
  value: 'Yearly',
  style: SELECT_STYLE,
  onChange: function(rt) {
    rangeType = rt;
  }
});
var helprange = ui.Button('?', 
  function() {show_help_panel('Generate a graph with the change in water area over a time frame in years or months for the current year')},
  false, HELP_BTN_SYTLE);
var genGraphBtn = ui.Button( 'Generate Trend Graph', plotTrend, false, BUTTON_STYLE);
var graphCntrl = ui.Panel([genGraphBtn,rangeTypeSelect,helprange],  ui.Panel.Layout.Flow('horizontal'), PANEL_STYLE);
//-------------------------------------------------------------  
var helpexp = ui.Button('?', function() {show_help_panel('Export current layers to Google Drive folder.')}, false, HELP_BTN_SYTLE);

var expMapBtn = ui.Button( 'Export Current Map', 
  exportMap, false, BUTTON_STYLE);
var exportPanel = ui.Panel([expMapBtn, helpexp],ui.Panel.Layout.Flow('horizontal'), PANEL_STYLE);
//-------------------------------------------------------------  
var trendPanel = ui.Panel([mapCntrl, graphCntrl], 
    ui.Panel.Layout.Flow('vertical'));
    
toolPanel.add(trendPanel);
toolPanel.add(exportPanel);
toolPanel.add(viewPanel);
toolPanel.add(mailPanel);

/*---------------------------------------------------------------------------------
*  Reference Panel: Source for GSW and S2 data
---------------------------------------------------------------------------------*/
// Create a hyperlink to an external reference.
var gsw_info = ui.Label(
    'GSW dataset: J.-F. Pekel, A. Cottam, N. Gorelick, A. S. Belward, "High-resolution mapping of global surface water and its long-term changes." Nature 540, 418-422 (2016).', 
    {backgroundColor: BACKCOLOR},
    'https://www.nature.com/articles/nature20584');
var sentinel_info = ui.Label('Copernicus/Sentinel-2 data available from Jun 23, 2015 - ',
    {backgroundColor: BACKCOLOR},
    'http://');
var referencePanel = ui.Panel([ui.Label('For more information', LABEL_T_STYLE), gsw_info, sentinel_info],'flow',PANEL_STYLE);

toolPanel.add(referencePanel);
