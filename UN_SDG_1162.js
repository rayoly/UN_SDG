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
var AOI = require('users/rayoly/SDG_APP:fnc/AOI.js');
var EXPORT_MAP = require('users/rayoly/SDG_APP:fnc/exportMap.js');
var GUIPREF = require('users/rayoly/SDG_APP:fnc/GUI_Prefs.js');
var LEGEND = require('users/rayoly/SDG_APP:fnc/Legend.js');
var HELP = require('users/rayoly/SDG_APP:fnc/helpBox.js');
var GUI_AOI = require('users/rayoly/SDG_APP:fnc/GUI_AOI.js');
var GUI_DATE = require('users/rayoly/SDG_APP:fnc/GUI_date.js');
var MODEL_POP = require('users/rayoly/SDG_APP:fnc/MODEL_Pop.js');
var GUI_POP = require('users/rayoly/SDG_APP:fnc/GUI_Pop.js');
var MODEL_AirQual = require('users/rayoly/SDG_APP:fnc/MODEL_AirQuality.js');
var GUI_MAP_INSPECTOR = require('users/rayoly/SDG_APP:fnc/GUI_MapInspector.js');
/************************************************************************************
 * Configure layers and locations
 ************************************************************************************/
//DEM
var DEM_DATASET = {data:ee.Image('CGIAR/SRTM90_V4'), scale:90, coef:1};

//Use dataset USDOS LSIB 2017
//var COUNTRY_DATASET = ee.FeatureCollection('USDOS/LSIB/2017');
var COUNTRY_DATASET = {data:ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017'), scale: 100};
//
var app = {};
app.AreaScale = 30;
app.country_name_key = 'country_ge';
app.defaultCountry = 'Germany';
app.defaultRegion = 'All';
app.rangeType = 'Monthly';
app.defaultYear = '2018';
app.defaultMonth = '09';
app.defaultAssetName = '';
app.defaultMinUrbanDensity = 300; //max urban population density in inhabitants/km2
//
app.performSegmentation = 0; //perform segementation on population dataset if no urban mask exist
app.SNIC_size = 1000;//seed location in meters
app.SNIC_compactness = 1;
//
app.defaultGas = 'NO2'
app.defaultRegionID = 11;
app.availableYears = ['2018','2019'];//Array.apply(null, {length: 28}).map( function(number, index){return (1990+index).toString()});//['1990','2000','2010','2011','2015'];
app.availableMonths = ['All','01','02','03','04','05','06','07','08','09','10','11','12'];
//
app.defaultPopAsset = '';
app.defaultRuralAsset = '';
app.defaultMortalityAsset = '';
//CRS
app.EXPORT_CRS = 'EPSG:4326';
/***********************************************************************************/
app.Mosaic_layer = {
  name: 'GAS_distrib',
  visParam : {min:0, max:0.0002, palette:['ffffff','f5f186','f4ce5c','eaa537','a65325','690c0e']},
  legend: {type:'continuous', title: 'Gas Concentration'}  
  };
app.layerProperties = {
    name: 'Gas',
    AreaScale: MODEL_AirQual.AIRMEAS[app.defaultGas].scale, //resolution
    visParam: {min:0,
              bands:app.defaultGas,
              max:0.0002,
              opacity:0.5,
              palette: ['white','yellow','red']},
    legend: {title: 'NO2', type:'continuous', style:[{'Urban': 'red'}, {'?': 'black'}, {'??': 'gray'}]},
    defaultVisibility: true
};
/****************************************************************************************
* Internal variables and config
*****************************************************************************************/
app.defaultLocation = AOI.CountryLoc[app.defaultCountry];

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
  resultPanel.style().set('shown',false);
}
/****************************************************************************************
* Transpose function
*****************************************************************************************/
function transpose(a) {
    return Object.keys(a[0]).map(function(c) {
        return a.map(function(r) { return r[c]; });
    });
}
/****************************************************************************************
* Convert dictionary into array for chart plot
*****************************************************************************************/
var Dict2Array = function(Xval, YListDict, dataTable){
	var i,s;
	Xval.map( function(X, n){
		dataTable[n+1] = [X];
    i=1;
    s=0;
    for(var key in YListDict[n]){
      dataTable[n+1].push( YListDict[n][key] );
      s+=YListDict[n][key];
      i++;
    }
    //remove year with 0 data
    if(s===0){
      dataTable[n+1][0] = null;
    }    
	});
	return dataTable;
}
/******************************************************************************
 * 
*******************************************************************************/
var CalcGAS = function(Year, CountryAbbr, lMonth, lRegion, isTrend){
  var yearRange, monthRange, regionRange;
  var time_trend = true;
  var PolygonLst = ee.List([]), result = ee.List([]);
  var scale, geeAssetPop,  geeAssetAir;
  var useGlobalDataset = 1;
  //
  if(isTrend===false){
    time_trend = true;
    yearRange = Year;
    monthRange = lMonth;
    regionRange = [GUI_AOI.regionName]; 
  }else if(app.rangeType=='Yearly'){
    time_trend = true;
    yearRange = Year;
    monthRange = ['All'];
    regionRange = [GUI_AOI.regionName]; 
  }else if(app.rangeType=='Monthly'){
    time_trend = true;
    //HELP.show_help_panel('Monthly trend for the year ' + app.defaultYear);
    //Years and months to consider
    yearRange = [app.defaultYear];
    monthRange = lMonth;
    regionRange = [GUI_AOI.regionName];    
  }else if(app.rangeType=='Regional' && GUI_AOI.selectedGEEAsset()===false){
    time_trend = false;
    //HELP.show_help_panel('Regional trend for the year ' + app.defaultYear);
    //Years and months to consider
    yearRange = [app.defaultYear];
    monthRange = ['All'];
    regionRange = lRegion.slice(1);//skip the first "region" which is "all"
  }else{
    HELP.show_help_panel('Incorrect Location/Trend mode combination! Regional trend cannot be performed with an asset.');
    return {};	
  }
  //LOOP
  //Generate list of polygons
  regionRange.forEach( function(region){
    var p = AOI.GetClippingPolygon(GUI_AOI.countryName, region, GUI_AOI.AssetName, 
      GUI_AOI.RegionID, GUI_AOI.selectedGEEAsset());
    var v = ee.Dictionary({region: ee.String(region), poly:ee.Geometry(p.polygon), outline:ee.Geometry(p.outline)});
    PolygonLst = PolygonLst.add( v );
  });
  //
  if(GUI_POP.selectedGEEAsset()){
    useGlobalDataset = 0;
    scale = Number(pop_reso_textbox.getValue()); 
    print('Imported Population dataset will be used. Scale=' + scale);
    //-- loaded Asset
    geeAssetPop = ee.Image(GUI_POP.PopAsset)
      .set('scale',scale,'database','GEEasset','name','Imported Asset').rename('GEEasset');
    yearRange = [app.defaultYear];
  }else{
    scale = 1000;
    geeAssetPop = ee.Image.constant(0).set('scale',100000,'database','undef','name','undef').rename('undef');
  }
  geeAssetAir = ee.Image(app.defaultAirAsset)
    .set('scale',scale,'database','GEEasset','name','Imported Asset').rename('GEEasset');

  //Set urban parameters
  MODEL_POP.setSNIC(app.SNIC_size, app.SNIC_compactness);
  MODEL_POP.setMinUrbanDensity(app.defaultMinUrbanDensity);
  MODEL_POP.setUrbanAsset(app.defaultRuralAsset);
  //
  var zeroImg = ee.Image.constant(0);//.selfMask();
  var oneImg  = ee.Image.constant(1);

  //Loop over regions
  result = PolygonLst.map(function(Polygon){

    var poly = ee.Geometry(ee.Dictionary(Polygon).get('poly'));
    var outline = ee.Geometry(ee.Dictionary(Polygon).get('outline'));
    var region_name = ee.Dictionary(Polygon).get('region');
    var area = ee.Image.pixelArea().clip(poly);

    //loop over years
    var res_year = ee.List(yearRange).map(function(year){
      //loop over months
      var res_month = ee.List(monthRange).map(function(month){
        //Save current time point
        var date = ee.String(ee.Algorithms.If(ee.String(month).compareTo('All').eq(0),
          ee.String(year),
          ee.String(year).cat('-').cat(month)));

        var DateRange = GUI_DATE.DateRange(year, month);
        var DateStart = DateRange.get(0);
        var DateEnd = DateRange.get(1);
      
        /*--------------------------------------------------------
        * Retrieve Global population dataset:
        *   Censuses
        * or
        *   WorldPop, Landscan of OakRidge, GRUMP
        ---------------------------------------------------------*/
        //get the last available dataset
        var PopMap = MODEL_POP.getPop(null, null, 
          poly, year, CountryAbbr, useGlobalDataset, geeAssetPop);
          
        /*--------------------------------------------------------
        * Retrieve Settlement dataset to identify urban areas
        ---------------------------------------------------------*/
        //Calculate urban Mask for each image population
        var UrbanMask = PopMap.map( function(img){  
          return MODEL_POP.CalcUrbanMask(img, poly, DateStart, DateEnd, app.performSegmentation);
        } );
        
        /*--------------------------------------------------------
        * Retrieve air quality indicators
        ---------------------------------------------------------*/
        var AirQual = MODEL_AirQual.getAirQual(DateStart, DateEnd, poly, year, CountryAbbr);   
    
        /*----------------------------------------------------------
        * Update PopMap with urban , access maps and stats
        ----------------------------------------------------------*/
        var gas_names = AirQual.aggregate_array('name');
        var gasDB_names = AirQual.aggregate_array('database');
        
        var scale = AirQual.first().get('scale');
        //loop over each population data
        PopMap = PopMap.map(function(img) {
          var bandname = img.bandNames().get(0);
          var mask = UrbanMask.filterMetadata('database','equals',bandname).first();
          img = img.rename('total');
          //Calculate urban population maps
          var urban = ee.Image(img.select('total').multiply(mask)).rename('urban');
          //Calculate stats
          var map_scale = scale;//ee.Image(img).get('scale');
          var stat_total = img.reduceRegion({reducer:'sum', crs:app.EXPORT_CRS, geometry: poly, scale: map_scale, maxPixels: 1e12}).get('total');
          var stat_urban = urban.reduceRegion({reducer:'sum', crs:app.EXPORT_CRS, geometry: poly, scale: map_scale, maxPixels: 1e12}).get('urban');
          // Population weighted annual mean level
          var PopWeightedAirQual = AirQual.map(function(air){
              return air.multiply(img);
          });
          var UrbanPopWeightedAirQual = AirQual.map(function(air){
              return air.multiply(urban);
          });          
          //
          var weightedGas = PopWeightedAirQual.toBands().rename(gasDB_names)
            .reduceRegion({
              reducer:'sum',
              crs:app.EXPORT_CRS, 
              geometry: poly, 
              scale: scale,//map_scale, 
              maxPixels: 1e12});
          //
          var urbanWeightedGas = UrbanPopWeightedAirQual.toBands().rename(gasDB_names)
            .reduceRegion({
              reducer:'sum', 
              crs:app.EXPORT_CRS, 
              geometry: poly, 
              scale: scale,//map_scale, 
              maxPixels: 1e12});
          //weighted average
          weightedGas = weightedGas.map(function(key, val) {return ee.Number(val).divide(stat_total)});
          urbanWeightedGas = urbanWeightedGas.map(function(key, val) {return ee.Number(val).divide(stat_urban)});
          //
          return img
            .addBands( urban )
            .set('total_pop', stat_total)
            .set('urban_pop', stat_urban)
            .set('weightedGas', weightedGas)
            .set('urbanWeightedGas', urbanWeightedGas)
            .set('source', mask.get('source'));
        });
        //for reference
        var gas = AirQual.toBands().rename(gasDB_names)
          .reduceRegion({
            reducer:'mean', 
            crs:app.EXPORT_CRS, 
            geometry: poly, 
            scale: scale,//map_scale, 
            maxPixels: 1e12});
        //
       var database = ee.List(PopMap.aggregate_array('database'));
        //return dictionary with all values
        return ee.Dictionary({
          //date
          date: date,
          
          //bounding area
          BoundaryPolygon: poly,
          Outline: outline,
          region: region_name,
          
          //Population datasets: total, urban
          PopMap:PopMap.map( function(img){return img.select('total')}).toBands().rename(database),
          UrbanMap:PopMap.map( function(img){return img.select('urban')}).toBands().rename(database),
          
          //Air Quality
          AirQual: AirQual,

          //Masks: urban mask, Walkable area
          UrbanMask: UrbanMask.toBands().rename(database),
          
          //Statistics
          DB_description: ee.Dictionary.fromLists(database, ee.List(PopMap.aggregate_array('name'))),
          total_stats: ee.Dictionary.fromLists(database, ee.List(PopMap .aggregate_array('total_pop'))),
          urban_stats: ee.Dictionary.fromLists(database, ee.List(PopMap.aggregate_array('urban_pop'))),
          urbanSource: ee.Dictionary.fromLists(database, ee.List(PopMap.aggregate_array('source'))),
          weightedGas:ee.Dictionary.fromLists(database, ee.List(PopMap.aggregate_array('weightedGas'))),
          urbanWeightedGas:ee.Dictionary.fromLists(database, ee.List(PopMap.aggregate_array('urbanWeightedGas'))),
          PopDateRangeStart: ee.Dictionary.fromLists(database, ee.List(PopMap.aggregate_array('DateStart'))),
          PopDateRangeEnd: ee.Dictionary.fromLists(database, ee.List(PopMap.aggregate_array('DateEnd'))),
          GasList: ee.Dictionary.fromLists(gasDB_names, gas_names),
          Gas: gas
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
* 
*****************************************************************************************/
var DisplayPopLayer = function(){
  //Clear Map
  ClearMap();
  //Clear Result Panel
  ClearresultPanel();
  
  //-----------------------------------------------------------------------------------
  var countryAbbr = AOI.countryCode(GUI_AOI.countryName);
  var result = CalcGAS([app.defaultYear], countryAbbr, [app.defaultMonth],[GUI_AOI.regionName],false);
  result = ee.Dictionary(result.get(0));
  /*------------------------------------------------------
  * Plots MAPS
  ------------------------------------------------------*/
  //Add region outline to map  
  mapPanel.add(ui.Map.Layer(ee.Geometry(result.get('Outline')), {}, 'Region'));

  //Plot urban clusters
  mapPanel.addLayer(ee.Image(result.get('UrbanMask')), {min:0, max:1, opacity:1.0}, 'Urban Mask', false);

  //Urban population
  var urban_map_visParam = {min:0, palette: ["#ffffff","#ff00d3"]};
  mapPanel.addLayer(ee.Image( result.get('UrbanMap') ), {}, 'Urban population',false); 

  //Air quality
  var AirQual = ee.ImageCollection(result.get('AirQual'));
  var gas_names = AirQual.aggregate_array('name');
  var gasDB_names = AirQual.aggregate_array('database');
  AirQual = AirQual.toBands().rename(gasDB_names);
  mapPanel.addLayer( AirQual, 
    app.layerProperties.visParam, 
    'Air Quality',true); 
    
  LEGEND.setLegend(app.layerProperties, GUIPREF, AirQual.select(app.layerProperties.visParam.bands));
  
  //Plot population
  mapPanel.addLayer(ee.Image(result.get('PopMap')), {}, 'Population',false);

  //-Results
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
      print(data.PopDateRangeStart);
      print(data.PopDateRangeEnd);
      var gas = data.Gas;
      var weightedGas = data.weightedGas;
      var pop_keys = Object.keys(weightedGas);
      var gas_keys = Object.keys(weightedGas[pop_keys[0]]);
      //Update callback
      GasSelect.onChange( function(value) {
        app.defaultGas = value;
        app.layerProperties.visParam.bands = value;
        app.layerProperties.legend.title = data.GasList[value];
        //Update legend and retrieve bounds
        app.layerProperties = 
          LEGEND.setLegend(app.layerProperties, GUIPREF, AirQual.select(app.layerProperties.visParam.bands));
        //update layer visual param
        mapPanel.layers().get(3).setVisParams(app.layerProperties.visParam);
      });

      //clear result Panel
      ClearresultPanel();
      //Create summary panel
      var dataTable = [ ];
      var GAS_dataTable = [[' '], ['Mean'] ];
      var factor;

      gas_keys.forEach( function(gas_key) {
        factor = MODEL_AirQual.AIRMEAS[gas_key].factor;
        GAS_dataTable[0].push(gas_key);
        var v = factor * gas[gas_key];
        if(Math.abs(v)<0.1 && v!==0){
          GAS_dataTable[1].push( v.toExponential(3) );
        }else{
          GAS_dataTable[1].push( v.toFixed(3) );
        }
      });
      
      resultPanel.widgets().set(0, 
        ui.Label('Mean gas concentration during ' + data.date +':\n'));
      resultPanel.widgets().set(1, 
        ui.Chart(GAS_dataTable, 'Table', {}));
      
      /*---- Loop over gases ----*/
      var n=0;
      dataTable = [ ['Gas']  ];
      pop_keys.forEach(function(pop_key){ dataTable[0].push( data.DB_description[pop_key] ); });
      //
      gas_keys.forEach( function(gas_key) {
        dataTable[n+1] = [ gas_key ];
        factor = MODEL_AirQual.AIRMEAS[gas_key].factor;
        /*---- Loop over population dataset ----*/
        pop_keys.forEach(function(pop_key){
          var v = factor * weightedGas[pop_key][gas_key];
          if(Math.abs(v)<0.1 && v!==0){
            dataTable[n+1].push( v.toExponential(2) );
          }else{
            dataTable[n+1].push( v.toFixed(2) );
          }          
        });
        n++;
      });//end loop over gases
      //Create column chart and insert it in the result panel at position 2
      //add to panel
      resultPanel.widgets().set(2, 
        ui.Label('Population weighted Gas Concentrations during ' + data.date +':\n'));
      resultPanel.widgets().set(3, ui.Chart(dataTable, 'Table', {}));
      //
      resultPanel.style().set('shown',true);
      resultPanel.style().set('width','500px');
      resultPanel.style().set('height','400px');
    }
  });
};
/****************************************************************************************
* Plot statistics area over time period
*****************************************************************************************/
var plotTrend = function(){
  //clear map
  ClearMap(); 
  //clear result Panel
  ClearresultPanel();
  //
  var time_trend;
  var dataTable, dates, GAS_dataTable;
  var i;
  var TimeSeriesMap;
  //
  var result = CalcGAS(app.availableYears, AOI.countryCode(GUI_AOI.countryName), 
    app.availableMonths.slice(1,13), GUI_AOI.RegionLst, true);

  //AOI: Outline
  var Outline = result.map(function(r){return ee.Geometry(ee.Dictionary(r).get('Outline'));}).flatten();
  Outline = Outline.slice(1).iterate(function(cur, prev){return ee.Geometry(prev).union(ee.Geometry(cur));},
    Outline.get(0));  
  //Add region outline to map  
  mapPanel.add(ui.Map.Layer(ee.Geometry(Outline), {}, 'Region'));

  //print info panel
  resultPanel.style().set('shown',true);
  resultPanel.widgets().set(1, ui.Label('Computing trends...'));
  //Animation
  if(app.rangeType=='Yearly' || app.rangeType=='Monthly' || GUI_AOI.selectedGEEAsset()===true){
    TimeSeriesMap = result.map(function(r){
      var AirQual = ee.ImageCollection(ee.Dictionary(r).get('AirQual'));
      var gasDB_names = AirQual.aggregate_array('database');
      return AirQual.toBands().rename(gasDB_names).select(app.defaultGas);});
  }else{
    TimeSeriesMap = result.map(function(r){return ee.Image(ee.Dictionary(r).get('valued_poly')).toFloat();});
  }  
  TimeSeriesMap = ee.ImageCollection.fromImages(TimeSeriesMap);
  //
  result.evaluate( function(data){
    //Clear Panel
    resultPanel.clear();
    //
    var pop_keys = Object.keys(data[0].weightedGas);
    var gas_keys = Object.keys(data[0].weightedGas[ pop_keys[0] ]);	
    /*------------------------------- Time Trend ------------------------*/
    if(app.rangeType=='Yearly' || app.rangeType=='Monthly' || GUI_AOI.selectedGEEAsset()===true){
      time_trend = true;
      dates = data.map( function(d) {return d.date});
      //Create series name
      if(app.rangeType=='Yearly'){
        dataTable = [ ['Year'] ];	
        GAS_dataTable = [['Year']];	
      }else{
        dataTable = [ ['Month'] ];	
        GAS_dataTable= [['Month']];	
      }
      //
      dates.map( function(t, i){  GAS_dataTable[i+1] = [t]; });
      gas_keys.forEach( function(gas_key) {
        var factor = MODEL_AirQual.AIRMEAS[gas_key].factor;
        GAS_dataTable[0].push(gas_key);
        dates.map( function(t, i){
          GAS_dataTable[i+1].push( factor * data[i].Gas[gas_key]);
        });
      });
      //LineChart
      var allgaschart = ui.Chart(GAS_dataTable, 'LineChart').setOptions({
        title: 'Statistics',
        vAxes: {
          0: { title: 'Mean concentration [mol/m^2]' },
          1: { title: 'Aerosol Index', baselineColor: 'transparent'}
        },
        hAxis: {title: 'Time', gridlines: {count: 1}},
        interpolateNulls: true,
        pointSize: 1,
        lineWidth: 1,
        series: {
          0: {targetAxisIndex: 1, lineDashStyle: [4, 4]},//Aerosol
          1: {targetAxisIndex: 0, logScale: false},
          2: {targetAxisIndex: 0, logScale: false},
          3: {targetAxisIndex: 0, logScale: false},
          4: {targetAxisIndex: 0, logScale: false},
        }        
      });
      resultPanel.widgets().set(0, allgaschart);
  
      //Loop over each gas type
      gas_keys.map( function(gas_key, n){
        var factor = MODEL_AirQual.AIRMEAS[gas_key].factor;
        //Loop over each population dataset
        pop_keys.map( function(pop_key, i){
          dataTable[i] = [];
          data.map( function(f){ dataTable[i].push(factor*f.weightedGas[pop_key][gas_key]);});
        });//end loop over pop dataset
        var gasChart = ui.Chart.array.values(dataTable, 1, dates)
          .setChartType('LineChart')
          .setSeriesNames(pop_keys)
          .setOptions({
            title: 'Statistics for ' + gas_key,
            vAxes: { 0: { title: 'Mean concentration [mol/m^2]' } },
            hAxis: {title: 'Time', gridlines: {count: 1}},
            interpolateNulls: true,
            pointSize: 1,
            lineWidth: 1
          });
        resultPanel.widgets().set(n+2, gasChart );
      });//end loop over gases
      
      //Show result panel
      resultPanel.style().set('shown',true);
      resultPanel.style().set('height','500px');
    /*------------------------------- Regional Trend ------------------------*/
    }else if(app.rangeType=='Regional' && GUI_AOI.selectedGEEAsset()===false){
      time_trend = false;
      var Gas = data.map(function(d){return d.Gas});
      var weightedGas = data.map(function(d){return d.weightedGas});
      print(Gas)
      //Plot per region on the map
      app.Mosaic_layer.visParam.bands = Object.keys(data[0].DB_description);
      mapPanel.add(ui.Map.Layer( TimeSeriesMap.mosaic(), 
        app.Mosaic_layer.visParam, app.Mosaic_layer.name, true));
        
      //Plot gas distribution per region
      mapPanel.add(ui.Map.Layer( TimeSeriesMap, {}, 'Regional Gas', false));      
      
      //Create legend
      LEGEND.setLegend(app.Mosaic_layer, GUIPREF);
      //Create series name
      var dataGTable = [ ['Region'] ];	
      var dataWGTable = [ ['Region'] ];	
      Gas.map( function(val, key) { dataGTable[0].push( val ); } );
      weightedGas.map( function(val, key) { dataWGTable[0].push( val ); } );
      var RegionalGasArray = Dict2Array(data.map(function(d){return d.region}), Gas, dataGTable);
      var RegionalWGasArray = Dict2Array(data.map(function(d){return d.region}), weightedGas, dataWGTable);
        
      // Define a dictionary of customization options.
      var options = {
        title: 'Regional Statistics',
        vAxis: {title: 'Gas (mol/m^2)',logScale: false  },
        legend: {position: 'bottom'},
        hAxis: {title: 'Region',logScale: false  }
      };
      //
      resultPanel.widgets().set(1, ui.Label('Statistics during ' + app.defaultYear + ':\n'));
      resultPanel.widgets().set(2, ui.Chart(RegionalGasArray, 'ColumnChart', options));
      resultPanel.widgets().set(3, ui.Chart(RegionalWGasArray, 'ColumnChart', options));
      resultPanel.style().set('shown',true);
      resultPanel.style().set('height','300px');
    }
  
    // Visualization and animation parameters.
    var params = {
      crs: 'EPSG:3857',
      framesPerSecond: 1,
      region: data[0].Outline,
      bands: [app.defaultGas],
      min: 0.0,
      max: 5e-4,
      palette: ['white', 'orange', 'red'],
      dimensions: 512
    };
    resultPanel.widgets().set(20, ui.Thumbnail(TimeSeriesMap, params));
  });
  
};

/****************************************************************************************
* Plot 
*****************************************************************************************/
var exportMap = function(){
  var description = 'RAI_map_for_' + GUI_AOI.RegionID + '_' + app.defaultYear;
  var poly = AOI.GetClippingPolygon(GUI_AOI.countryName, region, GUI_AOI.AssetName, 
      GUI_AOI.RegionID, GUI_AOI.selectedGEEAsset());
  
  EXPORT_MAP.exportMap(mapPanel, description, app.AreaScale, poly.polygon, app.EXPORT_CRS)
};

/*=======================================================================================
                                           GUI
=======================================================================================*/
ui.root.setLayout(ui.Panel.Layout.flow('horizontal'));

/****************************************************************************************
* Help panel 
*****************************************************************************************/
//HELP.createHelpBox('This App can be used to evaluate the annual/monthly/regional air quality in cities and evaluate UN SDG Indicator 11.6.2 & 3.9.1', GUIPREF);
HELP.createHelpBox('This App can be used to evaluate the annual/monthly/regional air quality', GUIPREF);
/*---------------------------------------------------------------------------------
* Create a control panel.
---------------------------------------------------------------------------------*/
//var header = ui.Label('SDG 11.6.1: Annual mean level of particulate matter', GUIPREF.TITLE_STYLE);
var header = ui.Label('Air quality', GUIPREF.TITLE_STYLE);
var subheader = ui.Label('', GUIPREF.SUBTITLE_STYLE);
var toolPanel = ui.Panel([header, subheader], 'flow', GUIPREF.PANEL_STYLE);

/****************************************************************************************
* Create a map panel.
*****************************************************************************************/
var mapPanel = ui.Map();
mapPanel.add(HELP.help_panel);
// Take all tools off the map except the zoom and mapTypeControl tools.
mapPanel.setControlVisibility({all: true, zoomControl: true, mapTypeControl: true});
/******************************************************************************************
* GUI: Create the legend.
******************************************************************************************/
// Define a panel for the legend and give it a tile.
LEGEND.createLegend(mapPanel, GUIPREF);
/*---------------------------------------------------------------------------------
* Create a Result panel.
---------------------------------------------------------------------------------*/
var resultPanel = ui.Panel([],  'flow', 
  {border: '1px solid black', width: '350px', height: '200px', position: 'bottom-right', shown:false } );
var resultPanelTitle = ui.Label('Results', {fontWeight: 'bold', color:GUIPREF.TEXTCOLOR});
resultPanel.add(resultPanelTitle);

/****************************************************************************************
* Define the pulldown menu.  Changing the pulldown menu changes the displayed year
*****************************************************************************************/
/****************************************************************************************
* Define the pulldown menu.  Changing the pulldown menu changes the displayed year
*****************************************************************************************/
//Define year, month lists
GUI_DATE.YearList = app.availableYears;
GUI_DATE.MonthList = app.availableMonths;
//Create GUI
GUI_DATE.createGUI(mapPanel, HELP, GUIPREF, true, true, false);
//Set Callbacks
GUI_DATE.yearSelect.onChange(function(year) {app.defaultYear=year;});
GUI_DATE.monthSelect.onChange(function(month) {app.defaultMonth=month;});
GUI_DATE.yearSelect.setValue(app.defaultYear);
GUI_DATE.monthSelect.setValue(app.defaultMonth);

/******************************************************************************************
* GUI: Selection of a predefined shape.
******************************************************************************************/
GUI_AOI.createGUI(mapPanel, HELP, AOI, GUIPREF, app.defaultCountry, app.defaultRegion);
var LocationPanel = GUI_AOI.LocationPanel;
mapPanel.centerObject(ee.Geometry(GUI_AOI.Location.polygon));
GUI_AOI.setAsset(app.defaultAssetName,  app.defaultRegionID);

GUI_MAP_INSPECTOR.createGUI(mapPanel, HELP, GUIPREF, 
  ee.ImageCollection("COPERNICUS/S5P/OFFL/L3_NO2"), 'NO2_column_number_density');
GUI_MAP_INSPECTOR.setTitle('NO2');
GUI_MAP_INSPECTOR.setvAxisTitle('Gas Concentration [mol/m^2]');
/******************************************************************************************
* GUI: Population dataset and definition.
******************************************************************************************/
GUI_POP.createGUI(mapPanel, HELP, GUIPREF);
GUI_POP.setMaxRuralDensity(app.defaultMaxRuralDensity);
GUI_POP.setPopAsset(app.defaultPopAsset);
GUI_POP.setRuralAsset(app.defaultRuralAsset);
GUI_POP.setPerformSegmentation(app.performSegmentation);

/******************************************************************************************
* GUI: Indicator definition
******************************************************************************************/
var gas_lbl = ui.Label('Show Gas:', GUIPREF.LABEL_T_STYLE);
var GasSelect = ui.Select({
  items: ['CO','SO2','NO2','Aerosol','HCHO','PM25','PM10'],
  value: app.defaultGas,
  style: GUIPREF.SELECT_STYLE,
  onChange: function(value) {
    app.defaultGas = value;
    
  }
}); 
var GasPanel = ui.Panel([gas_lbl, GasSelect], 
	ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_SUBSUBPANEL_STYLE);
	
GUIPREF.EDIT_STYLE.width = '200px';
var mortalityrate_textbox = ui.Textbox({
  placeholder: 'mortality rate: users/<username>/....',
  style: GUIPREF.EDIT_STYLE,
  value: '',
  onChange: function(text) {
    app.defaultMortalityAsset = text;
  }
});

//Indicator definition panel
var IndicatorPanel = ui.Panel([ui.Label( 'Indicator Definition:', GUIPREF.LABEL_T_STYLE), 
  ui.Panel([ui.Label( 'Mortality Rate:', GUIPREF.LABEL_STYLE), mortalityrate_textbox],
  ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE)],
  'flow', GUIPREF.CNTRL_PANEL_STYLE);

/****************************************************************************************
// Create a visibility checkbox and an opacity slider.
****************************************************************************************/
// If the checkbox is clicked off, disable the layer pulldown and turn all the
// layers off. Otherwise, enable the select, and turn on the selected layer.
var ck_layeropacity = ui.Checkbox({
  label: 'Opacity',
  value: true,
  style: GUIPREF.CKBOX_STYLE,
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
var opacitySlider = ui.Slider({min: 0,  max: 1,  value: 1,  step: 0.01,  style: GUIPREF.SLIDER_STYLE});
opacitySlider.onSlide(function(value) {
  mapPanel.layers().forEach(function(element, index) {
    element.setOpacity(value);
  });
});

var mailPanel = ui.Panel([ui.Label('Raymond Olympio, 2019', {backgroundColor: GUIPREF.BACKCOLOR}, 'mailto:rayoly@gmail.com')], 
  ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
var viewPanel = ui.Panel([ck_layeropacity, opacitySlider], 
	ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);

//-------------------------------------------------------------
var helpmap = HELP.helpButton('Update the map with the urban mask, population for the selected year and region.');
var genMapBtn = ui.Button( 'Update Map', DisplayPopLayer, false, GUIPREF.BUTTON_STYLE);
var mapCntrl = ui.Panel([genMapBtn, helpmap],ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
//-------------------------------------------------------------
var rangeTypeSelect = ui.Select({
  items: ['Yearly','Monthly','Regional'],
  value: app.rangeType,
  style: GUIPREF.SELECT_STYLE,
  onChange: function(rt) {
    app.rangeType = rt;
  }
});
var helprange = HELP.helpButton('Generate a graph with the change in water quality over a time frame in years or months for the current year.'+
  '\nDisplay the extremum water quality loss and gain from the reference Year onwards.');
var genTrendBtn = ui.Button( 'Compute Trend', plotTrend, false, GUIPREF.BUTTON_STYLE);
var graphCntrl = ui.Panel([genTrendBtn, rangeTypeSelect, helprange],  
  ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
//-------------------------------------------------------------  
var helpexp = HELP.helpButton('Export current layers to Google Drive folder.');
var expMapBtn = ui.Button( 'Export Current Map', exportMap, false, GUIPREF.BUTTON_STYLE);
var exportPanel = ui.Panel([expMapBtn, helpexp], 
	ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);

//-------------------------------------------------------------  
var trendPanel = ui.Panel([mapCntrl, graphCntrl], 
    ui.Panel.Layout.Flow('vertical'));

/*---------------------------------------------------------------------------------
*  References
---------------------------------------------------------------------------------*/

var s5p_info = ui.Label(
    'Sentinel-5P', 
    {backgroundColor: GUIPREF.BACKCOLOR},
    'https://earth.esa.int/web/sentinel/technical-guides/sentinel-5p/products-algorithms');

var fbai_info = ui.Label(
    'HRSL: High Resolution Settlement Layer, Facebook AI African Population dataset', 
    {backgroundColor: GUIPREF.BACKCOLOR},
    'https://ai.facebook.com/blog/mapping-the-world-to-help-aid-workers-with-weakly-semi-supervised-learning');

var GHSL_info = ui.Label('GHSL: Pesaresi, Martino; Freire, Sergio (2016): GHS Settlement grid following the REGIO model 2014 in application to GHSL Landsat and CIESIN GPW v4-multitemporal (1975-1990-2000-2015). European Commission, Joint Research Centre (JRC)', 
  {backgroundColor: GUIPREF.BACKCOLOR},
  'http://data.europa.eu/89h/jrc-ghsl-ghs_smod_pop_globe_r2016a');
var worldPop_info = ui.Label('WorldPop Dataset', 
  {backgroundColor: GUIPREF.BACKCOLOR}, 
  'http://www.worldpop.org');

var OSM_info = ui.Label('OpenStreetMap data', 
  {backgroundColor: GUIPREF.BACKCOLOR}, 
  'http://download.geofabrik.de/');
  
var referencePanel = ui.Panel([ui.Label('References and for more information', GUIPREF.LABEL_T_STYLE), 
   s5p_info, GHSL_info, worldPop_info, fbai_info, OSM_info],'flow', GUIPREF.CNTRL_PANEL_STYLE);
/******************************************************************************************
* GUI: Screen layout
******************************************************************************************/
//result panel

//Tool panel
toolPanel.add(ui.Panel([ GUI_DATE.datePanel, LocationPanel,
	//IndicatorPanel,
	GUI_POP.PopulationPanel,
	trendPanel,exportPanel,
	GasPanel,
	viewPanel,
	GUI_MAP_INSPECTOR.InspectorControl,
	mailPanel,referencePanel],
	ui.Panel.Layout.flow('vertical',true)));
//map panel
mapPanel.add(resultPanel);
//overall window
ui.root.widgets().reset([toolPanel, mapPanel]); 