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
var MODEL_WATER = require('users/rayoly/SDG_APP:fnc/MODEL_Water.js');
/*=======================================================================================
                                           GLOBAL VARIABLES
=======================================================================================*/
var app = {};
//default values
app.defaultCountry = 'Namibia';
app.defaultRegion = 'All';
app.defaultYear = '1984';
app.defaultMonth = 'All';
app.defaultAssetName = '';
app.defaultDB = 'GSW';
app.rangeType = 'Yearly';
app.defaultIndice = 'NDWI';
app.NDWI_threshold = 0.5;
//date list
app.availableMonths = ['All','01','02','03','04','05','06','07','08','09','10','11','12'];
app.availableDB = ['GSW','S2'];
//CRS
app.EXPORT_CRS = 'EPSG:4326';
app.RegionID = 0;
/***********************************************************************************/
var NDWI_visParam = {bands:['NDWI'],min:-1, max:1, palette:['ffffff', 'ff0000', 'ffff00', '00ffff', '0000ff']};
var TimeSeriesParam = {
  name: 'Statistics',
  visParam: {bands: ['water_change'], min:-1, max:1, palette:['ff0000','000000','0000ff']},
  legend: {type:'discrete', name: 'Change', style:[{'Loss':'red'},{'Unchanged':'black'},{'Gain':'blue'}]}  
};
var layerProperties = {
  'GSW':{
    'Yearly': {
      name: 'Year',
      band: 'waterClass',
      min_data_value: 1,
      AreaScale: 30.0, //resolution
      availableYears: Array.apply(null, {length: 36}).map( function(number, index){return (1984+index).toString()}),
      trendSeries: ['Permanent', 'Seasonal','Permanent - Change','Seasonal - Change'],
      visParam: {min: 0, max: 3, palette: ['white', 'white', 'cyan', 'blue']},
      legend: {type:'discrete', style:[ {'Permanent (GSW)': 'blue'}, {'Seasonal (GSW)': 'cyan'} ]},
      defaultVisibility: true
    },
    'Monthly': {
      name: 'Month',
      band: 'water',
      min_data_value: 1,
      availableYears: Array.apply(null, {length: 36}).map( function(number, index){return (1984+index).toString()}),
      AreaScale: 30.0, //resolution
      trendSeries: ['Water'],
      visParam: {min: 0, max: 2, palette: ['white', 'blue']},
      legend: {type:'discrete', style:[ {'Water': 'blue'}, {'No Water': 'white'} ]},
      defaultVisibility: true
    },
    'Regional': {
      name: 'Water Coverage',
      band: 'waterClass',
      min_data_value: 1,
      availableYears: Array.apply(null, {length: 36}).map( function(number, index){return (1984+index).toString()}),
      AreaScale: 30.0, //resolution
      trendSeries: ['Water'],
      visParam: {bands: 'Permanent_water_coverage', min: 0, max: 1, palette: ['darkred',' red', 'orange', 'white', 'lightblue','blue', 'darkblue']},
      legend: {type:'continuous', title: 'Relative Water Area (%)'},
      defaultVisibility: true
    }    
  },
  'S2':{
    'Yearly': {
      name: 'Year',
      band: 'water',
      min_data_value: 0,
      availableYears: Array.apply(null, {length: 4}).map( function(number, index){return (2015+index).toString()}),
      AreaScale: 20.0, //resolution
      trendSeries: ['Water', 'Change'],
      visParam: {min: 0, max: 3, palette: ['white', 'blue']},
      legend: {type:'discrete', style:[ {'Water': 'blue'}, {'No Water': 'white'} ]},
      defaultVisibility: true
    },
    'Monthly': {
      name: 'Month',
      band: 'water',
      min_data_value: 0,
      availableYears: Array.apply(null, {length: 4}).map( function(number, index){return (2015+index).toString()}),
      AreaScale: 20.0, //resolution
      trendSeries: ['Water'],
      visParam: {min: 0, max: 3, palette: ['white', 'blue']},
      legend: {type:'discrete', style:[ {'Water': 'blue'}, {'No Water': 'white'} ]},
      defaultVisibility: true
    },
    'Regional': {
      name: 'Water Coverage',
      band: 'water',
      min_data_value: 0,
      availableYears: Array.apply(null, {length: 4}).map( function(number, index){return (2015+index).toString()}),
      AreaScale: 20.0, //resolution
      trendSeries: ['Water'],
      visParam: {bands: 'Total_water_coverage', min: 0, max: 1, palette: ['darkred',' red', 'orange', 'white', 'lightblue','blue', 'darkblue']},
      legend: {type:'continuous', title: 'Relative Water Area (%)'},
      defaultVisibility: true
    }    
  }
};
app.defaultLayer = layerProperties[app.defaultDB]['Yearly'];
MODEL_WATER.set_NDWI_threshold(app.NDWI_threshold);
/*=======================================================================================
                                           FUNCTIONS
=======================================================================================*/
/****************************************************************************************
* Clear map panel
*****************************************************************************************/
var ClearMap = function(){
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
* Calculate the max for the legend
*****************************************************************************************/
var RegionalTrendMapUpdate = function(type, visParam, area_permanent, area_seasonal, region_area){
    if(type=='Permanent'){
      visParam.bands = ['Permanent_water_coverage'];
      visParam.max =  Math.max.apply(Math, 
        area_permanent.map(function(e,i){ return 100.0*e/region_area[i]} )).toFixed(2);
    }else if(type=='Seasonal'){
      visParam.bands = ['Seasonal_water_coverage'];
      visParam.max =  Math.max.apply(Math, 
        area_seasonal.map(function(e,i){ return 100.0*e/region_area[i]} )).toFixed(2);
    }else{
      visParam.bands = ['Total_water_coverage'];
      visParam.max =  Math.max.apply(Math, 
        area_permanent.map(function(e,i){ return 100.0*(e + area_seasonal[i])/region_area[i]} )).toFixed(2);  
    }
    return visParam;
}
//
/****************************************************************************************
* Display water layer for the selected year and region
*****************************************************************************************/
var DisplayWaterLayer = function(){
  if(app.defaultMonth=='All'){
    app.defaultLayer = layerProperties[app.defaultDB]['Yearly'];
  }else{
    app.defaultLayer = layerProperties[app.defaultDB]['Monthly'];
  }
  
  //clip region
  var poly = GUI_AOI.GetClippingPolygon(GUI_AOI.countryName, GUI_AOI.regionName, 
    GUI_AOI.AssetName, GUI_AOI.RegionID);  

  //Generate water layer(s) based on Global surface water dataset or S2 data
  var ImgWaterRegion;
  if(app.defaultDB=='GSW'){
    ImgWaterRegion = MODEL_WATER.GSW(poly.polygon, app.defaultMonth, app.defaultYear);
  }else{
    ImgWaterRegion = MODEL_WATER.S2(poly.polygon, app.defaultIndice, app.defaultMonth, app.defaultYear);
  }
  
  //clear map
  ClearMap(); 
  //clear result Panel
  ClearresultPanel();
  
  //var gridOutlines = ee.Image().toByte().paint(ee.Feature(poly.polygon), 'red', 2); 
  
  //plot outline
  mapPanel.add(ui.Map.Layer(poly.outline, {}, 'Region'));
  
  //plot water layer
  mapPanel.add(ui.Map.Layer(ImgWaterRegion.select(app.defaultLayer.band), 
    app.defaultLayer.visParam, 
    app.defaultLayer.name + '_' + app.defaultYear + '-' + app.defaultMonth, 
    app.defaultLayer.defaultVisibility));
    
  //Calculate water extent
  var area_seasonal = ee.Number(0);
  var area_permanent = ee.Number(0);
  var AOI_area = ee.Number(GUI_AOI.AOIarea(poly.polygon, app.defaultLayer.AreaScale)).divide(1e6);
  var waterInfo, infotxt;
  if(app.defaultDB=='GSW'){
    area_permanent = ee.Number(waterCount(ImgWaterRegion.select(app.defaultLayer.band), GUI_AOI.Location.polygon, app.defaultLayer.AreaScale, 3)).divide(1e6);
    area_seasonal = ee.Number(waterCount(ImgWaterRegion.select(app.defaultLayer.band), GUI_AOI.Location.polygon, app.defaultLayer.AreaScale, 2)).divide(1e6);
    //
    infotxt = ee.String('Extent of water during ' + app.defaultYear +  '/' + app.defaultMonth + ' [' + app.defaultDB + ']:\n'
          + '*Permanent=')
          .cat(area_permanent.format('%.2f km2 (')).cat(area_permanent.divide(AOI_area).multiply(100).format('%.2f')).cat('% of AOI)\n*Seasonal=')
          .cat(area_seasonal.format('%.2f km2 (')).cat(area_seasonal.divide(AOI_area).multiply(100).format('%.2f')).cat('% of AOI)');
  }else{
    mapPanel.add(ui.Map.Layer(ImgWaterRegion,NDWI_visParam,'NDWI',false));
    area_permanent = ee.Number(waterCount(ImgWaterRegion.select(app.defaultLayer.band), GUI_AOI.Location.polygon, app.defaultLayer.AreaScale, 3)).divide(1e6);
    infotxt = ee.String('Extent of water during ' + app.defaultYear +  '/' + app.defaultMonth + ' [' + app.defaultDB + ']:\n'
          + '*Permanent=')
          .cat(area_permanent.format('%.2f km2 or (')).cat(area_permanent.divide(AOI_area).format('%.2f')).cat('% of AOI)');
  }
  //
  resultPanel.widgets().set(1, ui.Label('Computing...'));
  infotxt.evaluate(function(result, fail) {
    if(typeof fail !== 'undefined'){
      HELP.show_help_panel('Error during the calculation:' + fail);
      resultPanel.style().set('shown',false);      
    }else{
      resultPanel.clear();
      resultPanel.widgets().set(1, ui.Label(result, {fontWeight: 'bold', color: GUIPREF.TEXTCOLOR, whiteSpace:'pre'}) );
    }
  });
  //Results Panel
  //resultPanel.widgets().set(1, waterInfo);
  resultPanel.style().set('shown',true);
  resultPanel.style().set('height','120px');
  //Update legend
  LEGEND.setLegend(app.defaultLayer, GUIPREF);
};

/****************************************************************************************
* Extract water area
*****************************************************************************************/
var waterCount = function(image, geometry, AreaScale, WATER_TYPE){
  var waterArea = ee.Image(image)
                    .eq(WATER_TYPE)
                    .multiply(ee.Image.pixelArea())
                    .selfMask()
                    .rename('waterArea');

  var stats = waterArea.reduceRegion({
      reducer: ee.Reducer.sum(), 
      geometry: geometry, 
      scale: AreaScale,
      maxPixels: 1e11
    });
  var StrArea = stats.get('waterArea');
  return StrArea;
};


/****************************************************************************************
* Extract water area
*****************************************************************************************/
var CalcWaterArea = function(){
    //Output data
    var data = {date: [], region:[], Outline:[], Polygon:[],
      region_area:[], area_seasonal: [], area_permanent: [], 
      pctchange_permanent:[], pctchange_seasonal:[]}; 
    //  
    var area_seasonal, area_permanent, region_area, date;
    var i;
    var yearRange, monthRange, regionRange;
    var ImgWaterRegion;
    var TimeSeriesMap;
    var poly, outline;
    //
    if(app.rangeType=='Yearly'){
      //HELP.show_help_panel('Trend over all the years');
      //define layer to use
      app.defaultLayer = layerProperties[app.defaultDB].Yearly;
      //Years and months to consider
      yearRange = app.defaultLayer.availableYears;
      monthRange = ['All'];
      regionRange = [GUI_AOI.regionName];
    }else if(app.rangeType=='Monthly'){
      //HELP.show_help_panel('Monthly trend for the year ' + app.defaultYear);
      //define layer to use
      app.defaultLayer = layerProperties[app.defaultDB].Monthly;
      //Years and months to consider
      yearRange = [app.defaultYear];
      monthRange = app.availableMonths.slice(1,13);
      regionRange = [GUI_AOI.regionName];
    }else if(app.rangeType=='Regional' && GUI_AOI.selectedGEEAsset()===false){
      HELP.show_help_panel('Regional trend for the year ' + app.defaultYear);
      //define layer to use
      app.defaultLayer = layerProperties[app.defaultDB].Regional;
      //Years and months to consider
      yearRange = [app.defaultYear];
      monthRange = ['All']; 
      if(GUI_AOI.AssetName.length===0){
        regionRange = GUI_AOI.RegionLst.slice(1);//skip the first "region" which is "all"
      }else{
        regionRange = [GUI_AOI.regionName];
      }
    }else{
      HELP.show_help_panel('Incorrect Location/Trend mode combination!');
      return {};
    }
    //LOOP
    var PolygonLst = ee.List([]);
    var result = ee.List([]);
    //Generate list of polygons
    regionRange.forEach( function(region){
      var p = GUI_AOI.GetClippingPolygon(GUI_AOI.countryName, region, GUI_AOI.AssetName, GUI_AOI.RegionID);
      var v = ee.Dictionary({region: ee.String(region), poly:ee.Geometry(p.polygon), outline:ee.Geometry(p.outline)});
      PolygonLst = PolygonLst.add( v );
    });
  
    result = PolygonLst.map( function(Polygon){
      var region = ee.Dictionary(Polygon).get('region');
      poly = ee.Geometry(ee.Dictionary(Polygon).get('poly'));
      outline = ee.Geometry(ee.Dictionary(Polygon).get('outline'));
      //Region area
      region_area = ee.Number(waterCount(ee.Image.constant(1), poly, ee.Number(app.defaultLayer.AreaScale), 1)).divide(1e6);
      //loop over years
      var res_year = ee.List(yearRange).map(function(year){
        //loop over months
        var res_month = ee.List(monthRange).map(function(month){
          //Save current time point
          date = ee.String(ee.Algorithms.If(ee.String(month).compareTo('All').eq(0),
            ee.String(year),
            ee.String(year).cat('-').cat(month)));
          
          //-------- Load data &  Select band to use
          ImgWaterRegion = ee.Image(ee.Algorithms.If(ee.String(app.defaultDB).compareTo('GSW').eq(0),
            MODEL_WATER.GSW(poly, month, year),
            MODEL_WATER.S2(poly, app.defaultDB, month, year))).select(app.defaultLayer.band);
          
          //-------- Calculate areas
          area_permanent = ee.Number(waterCount(ImgWaterRegion, poly, ee.Number(app.defaultLayer.AreaScale), 3)).divide(1e6);
          area_seasonal = ee.Number(ee.Algorithms.If(app.defaultDB=='GSW',
            ee.Number(waterCount(ImgWaterRegion, poly.polygon, ee.Number(app.defaultLayer.AreaScale), 2)).divide(1e6),
            0));
          //Surface water coverage
          var WaterCvr = ee.Image.constant(area_permanent.divide(region_area).multiply(100))
                .clip(poly).rename('Permanent_water_coverage');
          WaterCvr = WaterCvr.addBands(ee.Image.constant(area_seasonal.divide(region_area).multiply(100))
                .clip(poly).rename('Seasonal_water_coverage'));
          WaterCvr = WaterCvr.addBands(ee.Image.constant(area_permanent.add(area_seasonal).divide(region_area).multiply(100))
                .clip(poly).rename('Total_water_coverage'));
          //----
          return ee.Dictionary({Map: ImgWaterRegion, 
            Outline: outline,
            Polygon: poly,
            WaterCoverage: WaterCvr,
            area_permanent:area_permanent, area_seasonal: area_seasonal, 
            region_area: region_area,  date: date, region: region});
        }).flatten();
        return res_month;
      }).flatten();
      return res_year;
    }).flatten();
    //
    return result;
};

/****************************************************************************************
* Plot water area over time period
*****************************************************************************************/
var plotTrend = function(){
  app.defaultLayer = layerProperties[app.defaultDB][app.rangeType];

  var result = CalcWaterArea();
  //if( Object.keys(alldata).length===0 ){return;}
  var areas, title;
  var TimeSeriesMap;
  var area_permanent, area_seasonal, region_area;
  //clear map
  ClearMap(); 
  //clear result Panel
  ClearresultPanel();
  resultPanel.style().set('shown',true);
  //Outline
  var Outline = result.map(function(r){return ee.Geometry(ee.Dictionary(r).get('Outline'));}).flatten();
  Outline = Outline.slice(1).iterate(function(cur, prev){return ee.Geometry(prev).union(ee.Geometry(cur));},
    Outline.get(0));  
  //Add outline to map
  mapPanel.add(ui.Map.Layer(ee.Geometry(Outline), {}, 'Region'));    
  //Update result Panel
  if(app.rangeType=='Regional'){
    resultPanel.widgets().set(1, ui.Label('Calculating Regional Trend...'));
    //
    TimeSeriesMap = result.map(function(r){return ee.Image(ee.Dictionary(r).get('WaterCoverage')).toFloat();});
    TimeSeriesMap = ee.ImageCollection.fromImages(TimeSeriesMap);
    //
    result.evaluate(function(data, fail){
      if(typeof fail !== 'undefined'){
        HELP.show_help_panel('Error during the regional trend calculation:' + fail);
      }else{
        area_permanent = data.map(function(d){return d.area_permanent});
        area_seasonal = data.map(function(d){return d.area_seasonal});  
        region_area = data.map(function(d){return d.region_area});        
        //clear result Panel
        ClearresultPanel();
        //
        layer_menu.onChange( function(value) {
          app.defaultLayer.visParam = RegionalTrendMapUpdate(value, app.defaultLayer.visParam,
            area_permanent, area_seasonal, region_area);
          //update layer visual param
          mapPanel.layers().get(0).setVisParams(app.defaultLayer.visParam);
          //Update legend
          LEGEND.setLegend(app.defaultLayer, GUIPREF);
        });
          
        app.defaultLayer.visParam = RegionalTrendMapUpdate(layer_menu.getValue(), app.defaultLayer.visParam,
            area_permanent, area_seasonal, region_area);
            
        //Add regional data to map
        mapPanel.add(ui.Map.Layer( TimeSeriesMap.mosaic(), 
          app.defaultLayer.visParam, app.defaultLayer.name,true));    

        //Create legend
        LEGEND.setLegend(app.defaultLayer, GUIPREF);
        
        //Create summary panel
        var waterInfo = ui.Label('Extent of water during ' + app.defaultYear +' [' + app.defaultDB + ']:\n');
        //
        var dataTable = [ ['Region', 'Region Area', 'Permanent Water Area', 'Seasonal WaterArea'] ];
        var n;
        for(n=0;n<data.length;n++){
          dataTable[n+1] = [data[n].region, data[n].region_area, data[n].area_permanent, data[n].area_seasonal];
        }
        // Define a dictionary of customization options.
        var options = {
          title: 'Regional Statistics',
          vAxis: {title: 'Area (km2)',logScale: true  },
          legend: {position: 'bottom'},
          hAxis: {title: 'Region',logScale: false  }
        };
        //Create column chart and insert it in the result panel at position 2
        var chart = ui.Chart(dataTable, 'ColumnChart', options);
        resultPanel.widgets().set(1, waterInfo);
        resultPanel.widgets().set(2, chart);
        resultPanel.style().set('shown',true);
        resultPanel.style().set('height','400px');
      }
    });
  }else{ //Yearly or Monthly trend
    resultPanel.widgets().set(1, ui.Label('Calculating Time Series...'));
    //
    TimeSeriesMap = ee.ImageCollection.fromImages(result.map(function(r){return ee.Dictionary(r).get('Map');}));
    TimeSeriesMap = TimeSeriesMap.map(
      function(img){
        return img.gte(1.0)
          .rename('water')
          .copyProperties({source: img});
    });
    //
    result.evaluate(function(data, fail){
     //clear result Panel
      ClearresultPanel();
      if(typeof fail !== 'undefined'){
        HELP.show_help_panel('Error during the time series calculation:' + fail);
      }else{
        //5-year average
        area_permanent = data.map(function(d){return d.area_permanent});
        area_seasonal = data.map(function(d){return d.area_seasonal});
        var pctchange_seasonal=[];
        var pctchange_permanent=[];
        if(app.rangeType=='Yearly'){
          var gamma2, gamma3;
          var beta3 = AVG.Average5( area_permanent, 2001-1984);
          var beta2 = AVG.Average5( area_seasonal , 2001-1984);      
          for(var i=0;i<area_permanent.length;i++){
              gamma2 = AVG.Average5(area_seasonal,i);
              gamma3 = AVG.Average5(area_permanent,i);
              pctchange_seasonal.push( (beta2-gamma2)/beta2*100 );
              pctchange_permanent.push( (beta3-gamma3)/beta3*100 );
          }
        }
        //
        if(app.defaultLayer.name=='Year' && app.defaultLayer.trendSeries.length==4){
          areas = [area_permanent, area_seasonal, pctchange_seasonal, pctchange_permanent];
        }else if(app.defaultLayer.name=='Year' && length(app.defaultLayer.trendSeries)==2){
          areas = [area_permanent, [], pctchange_permanent, []];
        }else{
          areas = [area_seasonal, [], [], []];
        }
        //Print title
        if(app.defaultAssetName.length===0){
          title = 'Water Area Over Time over ' + GUI_AOI.countryName + '.' + GUI_AOI.regionName +
              ' during '+ app.defaultYear + '/' + app.defaultMonth;
        }else{
          title = 'Water Area Over Time over ' + GUI_AOI.AssetName + '.' + GUI_AOI.RegionID + 
              ' during '+ app.defaultYear + '/' + app.defaultMonth;
        }
        var dates = data.map(function(f){return f.date});
        var waterChart = ui.Chart.array.values(areas, 1, dates)
          .setChartType('LineChart')
          .setSeriesNames(app.defaultLayer.trendSeries)
          .setOptions({
            title: title,
            vAxes: {
              0: { title: 'Area [km2]' },
              1: {
                title: '% Area Change (Ref: 2001-2005)',
                baselineColor: 'transparent'
                }
            },
            hAxis: {title: app.defaultLayer.name, gridlines: {count: 1}},
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
        //Results Panel
        resultPanel.widgets().set(1, waterChart);
        resultPanel.style().set('shown',true);
        resultPanel.style().set('height','400px');
      
        // Visualization and animation parameters.
        var params = {
          crs: app.EXPORT_CRS,
          framesPerSecond: 4,
          region: data[0].Polygon,
          min: 0.0,
          max: 1.0,
          palette: ['silver', 'white', 'cyan', 'blue'],
          dimensions: 512
        };
        resultPanel.widgets().set(2, ui.Thumbnail(TimeSeriesMap, params));
      
        //Add outline to map
        mapPanel.add(ui.Map.Layer(ee.Geometry(Outline), {}, 'Region'));
        //water mask
        var LE = ee.Number( data.length );
        var water_mask = TimeSeriesMap
                          .map(function(f) {return f.unmask(0)})
                          .sum().gt(0.0)
                          //.reduce(ee.Reducer.anyNonZero())
                          .rename('water_mask');
                          
        //water_mask = ee.Image.constant(1).clip(alldata.Region).rename('water_mask');
        
        //apply water mask
        TimeSeriesMap = TimeSeriesMap
            .map(function(f) {return f.unmask(0).updateMask(water_mask)});
      
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
    
        //add mask
        //timeseriesmap = timeseriesmap.addBands(water_mask);
        //add permanent
        timeseriesmap = timeseriesmap.addBands(
            (timeseriesmap.select('water_count').eq(LE)).gt(0.0)
            .updateMask(water_mask)
            .rename('water_permanent')
          );
    
        //add water change band
        var water_reference,water_exam_range;
        var water_loss, water_gain;
        var year = app.defaultYear;
        var month = app.defaultMonth;
      
        if(app.rangeType=='Yearly'){
          //define reference water level
          water_reference = TimeSeriesMap
              .filterMetadata('year', 'equals',parseInt(year)).first();
          //gain
          water_exam_range = TimeSeriesMap
              .filterMetadata('year', 'greater_than',parseInt(year));
        }else{
          if(month=='All'){month='01';}
          
          //define reference water level
          water_reference = TimeSeriesMap
              .filterMetadata('year', 'equals',parseInt(year))
              .filterMetadata('month', 'equals',parseInt(month)).first();
          //range of interest to examine variation
          water_exam_range = TimeSeriesMap
              .filterMetadata('year', 'equals',parseInt(year))
              .filterMetadata('month', 'greater_than',parseInt(month));
        }
        water_exam_range = ee.ImageCollection(ee.Algorithms.If(water_exam_range.size(),
          water_exam_range,
          ee.ImageCollection.fromImages(ee.List([ee.Image.constant(0)]))));
    
        //gain
        water_gain = water_exam_range
            .map(function(img) {return img.subtract(water_reference)})
            .max().gt(0).rename('water_gain');
        //loss
        water_loss = water_exam_range
            .map(function(img) {return img.subtract(water_reference)})
            .min().lt(0).multiply(-1.0).rename('water_loss');
            
        var water_change = water_gain.add(water_loss).rename('water_change');
      
        timeseriesmap = timeseriesmap.addBands( water_mask.updateMask(water_mask.neq(0)) );
        timeseriesmap = timeseriesmap.addBands( water_loss.updateMask(water_loss.neq(0)) );
        timeseriesmap = timeseriesmap.addBands( water_gain.updateMask(water_gain.neq(0)) );
        timeseriesmap = timeseriesmap.addBands( water_change );
        //
        mapPanel.add(ui.Map.Layer(timeseriesmap, TimeSeriesParam.visParam, TimeSeriesParam.name,true));
        mapPanel.add(ui.Map.Layer(TimeSeriesMap, {}, 'Time Series',false));
        //Create legend
        LEGEND.setLegend(TimeSeriesParam, GUIPREF);
      }
    });
  }
};

/****************************************************************************************
* Export
*****************************************************************************************/
var exportMap = function(){
  HELP.show_help_panel('Generating Export Task for '+ GUI_AOI.countryName + ' in ' + app.defaultYear + '.' + app.defaultMonth);

  var description = 'Water_map_for_' + app.RegionID + '_' + app.defaultYear + '-' + app.defaultMonth;
  var poly = GUI_AOI.GetClippingPolygon(GUI_AOI.countryName, GUI_AOI.regionName, 
    GUI_AOI.AssetName, GUI_AOI.RegionID);
  
  EXPORT_MAP.exportMap(mapPanel, description, app.defaultLayer.AreaScale, poly.polygon, app.EXPORT_CRS);
};

/*=======================================================================================
                                           GUI
=======================================================================================*/
/****************************************************************************************
* Help panel 
*****************************************************************************************/
HELP.createHelpBox('This App can be used to evaluate the trend in water area and evaluate UN SDG Indicator 6.6.1', GUIPREF);

/*****************************************************************************************
 * Map panel configuration
 *****************************************************************************************/
ui.root.setLayout(ui.Panel.Layout.flow('horizontal'));

/****************************************************************************************
* GUI: Create a control panel.
*****************************************************************************************/
var header = ui.Label('SDG 6.6.1: Water Change', GUIPREF.TITLE_STYLE);
var subheader = ui.Label('Sub-Indicator 1', GUIPREF.SUBTITLE_STYLE);
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

/****************************************************************************************
* GUI: Create a plotting/results panel.
****************************************************************************************/
var resultPanel = ui.Panel([
    ui.Label('Water Area Over Time', {fontWeight: 'bold', color:GUIPREF.TEXTCOLOR})
  ],  'flow', GUIPREF.RESULT_PANEL_STYLE);


/****************************************************************************************
* Define the pulldown menu.  Changing the pulldown menu changes the displayed year
*****************************************************************************************/
//Define year, month lists
GUI_DATE.YearList = Array.apply(null, {length: 39}).map( function(number, index){return (1984+index).toString()});
GUI_DATE.MonthList = app.availableMonths;
//Create GUI
GUI_DATE.createGUI(mapPanel, HELP, GUIPREF, true, true, false);
//Set Callbacks
GUI_DATE.yearSelect.onChange(function(year) {app.defaultYear=year;});
GUI_DATE.monthSelect.onChange(function(month) {
    app.defaultMonth = month;
    if(app.defaultMonth=='All'){
      app.defaultLayer = layerProperties[app.defaultDB].Yearly;
    }else{
      app.defaultLayer = layerProperties[app.defaultDB].Monthly;
    }
    LEGEND.setLegend(app.defaultLayer, GUIPREF);
  }
);

/******************************************************************************************
* GUI: dataset selection.
******************************************************************************************/
var DBSelect = ui.Select({
  items: app.availableDB,
  value: app.defaultDB,
  style: GUIPREF.SELECT_STYLE,
  onChange: function(value) {
    app.defaultDB = value;
    //update layer prop
    if(app.defaultMonth=='All'){
      app.defaultLayer = layerProperties[app.defaultDB].Yearly;
    }else{
      app.defaultLayer = layerProperties[app.defaultDB].Monthly;
    }
    //Update year drop down
    GUI_DATE.yearSelect.setValue(app.defaultLayer.availableYears[0]);
    //Update legend
    LEGEND.setLegend(app.defaultLayer, GUIPREF);
  }
});    

GUIPREF.EDIT_STYLE.width = '50px';
var ndwi_textbox = ui.Textbox({
  value: app.NDWI_threshold,
  placeholder: 'NDWI threshold',
  style: GUIPREF.EDIT_STYLE,
  onChange: function(text) {
    app.NDWI_threshold = Number(text);
    MODEL_WATER.set_NDWI_threshold(app.NDWI_threshold);
    HELP.show_help_panel('NDWI Threshold ' + app.NDWI_threshold );
  }
});

var DBPanel = ui.Panel([ui.Label('Dataset:', GUIPREF.LABEL_T_STYLE),   DBSelect,
  ndwi_textbox,
  HELP.helpButton('GSW: Global Surface Water v1.0. (1984-2015) \nS2: Level 1C Sentinel-2 data used to calculate NDWI. (2015-)'
  + '\nThe NDWI default threshold is 0.5.'
  + '\nDue to the complexity of accurately detecting water over long timeframes,'
  + ' it is recommended to use GSW.')], 
  ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_SUBPANEL_STYLE);



/******************************************************************************************
* GUI: Selection of a predefined shape.
******************************************************************************************/
GUI_AOI.createGUI(mapPanel, HELP, GUIPREF, app.defaultCountry,app.defaultRegion);
var LocationPanel = GUI_AOI.LocationPanel;
mapPanel.centerObject(ee.Geometry(GUI_AOI.Location.polygon));

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
var ck_layeropacity = ui.Checkbox({
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

var layer_lbl = ui.Label('Show Layer:', GUIPREF.LABEL_T_STYLE);
var layer_menu = ui.Select({
  items: ['Permanent','Seasonal','Permanent+Seasonal'],
  value: 'Permanent',
  style: GUIPREF.SELECT_STYLE,
  onChange: function(value) { }
}); 
var opacityPanel = ui.Panel([ck_layeropacity, opacitySlider], 
	ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_SUBSUBPANEL_STYLE);
var layerPanel = ui.Panel([layer_lbl, layer_menu], 
	ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_SUBSUBPANEL_STYLE);
layerPanel.style().set('shown', false);
var viewPanel = ui.Panel([opacityPanel, layerPanel], 
	ui.Panel.Layout.Flow('vertical'), GUIPREF.CNTRL_SUBPANEL_STYLE);
//-------------------------------------------------------------
var helpmap = HELP.helpButton('Update the map with the water layer calculated from the selected dataset, year and month. When Month="All", the yearly average is displayed.');
var genMapBtn = ui.Button( 'Update Map', DisplayWaterLayer, false, GUIPREF.BUTTON_STYLE);
var mapCntrl = ui.Panel([genMapBtn, helpmap],ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_SUBPANEL_STYLE);

//-------------------------------------------------------------  
var rangeTypeSelect = ui.Select({
  items: ['Yearly','Monthly','Regional'],
  value: 'Yearly',
  style: GUIPREF.SELECT_STYLE,
  onChange: function(rt) {
    app.rangeType = rt;
    app.defaultLayer = layerProperties[app.defaultDB][app.rangeType];
    if(rt==='Regional'){
      layerPanel.style().set('shown', true);
    }else{
      layerPanel.style().set('shown', false);
    }
  }
});
var helprange = HELP.helpButton('Generate a graph with the change in water area over a time frame in years or months for the current year.'+
  '\nDisplay the extremum water loss and gain from the reference Year onwards.');
var genGraphBtn = ui.Button( 'Compute Trend', plotTrend, false, GUIPREF.BUTTON_STYLE);
var graphCntrl = ui.Panel([genGraphBtn, rangeTypeSelect, helprange],  
  ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_SUBPANEL_STYLE);

//-------------------------------------------------------------  
var helpexp = HELP.helpButton('Export current layers to Google Drive folder.');
var expMapBtn = ui.Button( 'Export Current Map', 
  exportMap, false, GUIPREF.BUTTON_STYLE);
var exportPanel = ui.Panel([expMapBtn, helpexp],ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
//-------------------------------------------------------------  
var trendPanel = ui.Panel([mapCntrl, graphCntrl], ui.Panel.Layout.Flow('vertical'));

//-------------------------------------------------------------
var mailPanel = ui.Panel([ui.Label('Raymond Olympio, 2019', {backgroundColor: GUIPREF.BACKCOLOR}, 'mailto:rayoly@gmail.com')], 
  ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
  
/*---------------------------------------------------------------------------------
*  Reference Panel: Source for GSW and S2 data
---------------------------------------------------------------------------------*/
// Create a hyperlink to an external reference.
var gsw_info = ui.Label(
    'GSW dataset: J.-F. Pekel, A. Cottam, N. Gorelick, A. S. Belward, "High-resolution mapping of global surface water and its long-term changes." Nature 540, 418-422 (2016).', 
    {backgroundColor: GUIPREF.BACKCOLOR},
    'https://www.nature.com/articles/nature20584');
var sentinel_info = ui.Label('Copernicus/Sentinel-2 L2A data available from Mar 28, 2017 - ',
    {backgroundColor: GUIPREF.BACKCOLOR},
    'http://');
var referencePanel = ui.Panel([ui.Label('For more information:', GUIPREF.LABEL_T_STYLE), gsw_info, sentinel_info],
  'flow', GUIPREF.CNTRL_SUBPANEL_STYLE);

/******************************************************************************************
* GUI: Screen layout
******************************************************************************************/
//result panel

//Tool panel
toolPanel.add(ui.Panel([DBPanel, GUI_DATE.datePanel, LocationPanel,
	trendPanel, exportPanel, viewPanel,
	mailPanel,
	referencePanel],
	ui.Panel.Layout.flow('vertical',true)));
//map panel
mapPanel.add(resultPanel);
//overall window
ui.root.widgets().reset([toolPanel, mapPanel]); 
