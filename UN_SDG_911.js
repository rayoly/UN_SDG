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

/************************************************************************************
 * Configure layers and locations
 ************************************************************************************/
//Water data set: GSW
var WATER_DATASET = {data:ee.ImageCollection('JRC/GSW1_0/YearlyHistory'), rural_mask:[], scale:30, coef:1};
//Accessibility to cities
var CITYACCESS_DATASET = {data:ee.Image('Oxford/MAP/accessibility_to_cities_2015_v1_0'), rural_mask:[], scale:1000, coef:1};//30 arcsec
//DEM
var DEM_DATASET = {data:ee.Image('CGIAR/SRTM90_V4'), scale:90, coef:1};
//Population dataset
//GHSL: Global Human Settlement Layers, Population Grid 1975-1990-2000-2015 (P2016)
//Dataset from facebook, ingested in asset population_AF_2018-10-01: https://ai.facebook.com/blog/mapping-the-world-to-help-aid-workers-with-weakly-semi-supervised-learning/
//https://data.humdata.org/dataset/highresolutionpopulationdensitymaps

var POP = { GHSL: {data:ee.ImageCollection('JRC/GHSL/P2016/POP_GPW_GLOBE_V1'), scale: 250, coef:1}, //250m resolution
            WORLDPOP: {data:ee.ImageCollection("WorldPop/POP"), rural_mask:[], scale: 100, coef:1},//100x100, 3arcsec
            GPW: {data:ee.ImageCollection("CIESIN/GPWv4/population-count"), scale: 1000, coef:1}, //1000x1000, 30arcsec
            FACEBOOKAI: {data:ee.ImageCollection.fromImages(ee.List([ee.Image('users/' + CONFIG.USER + '/population_AF_2018-10-01')
              .set('system:time_start',ee.Date.fromYMD(2018, 3, 1 ).millis())
              .set('system:time_end',ee.Date.fromYMD(2018, 12, 31 ).millis())])),	scale: 30, coef:1}, //1 arcsec=30m
            };

var empty_mask = ee.ImageCollection([ee.Image([])])
              .set('system:time_start',ee.Date.fromYMD(1990, 3, 1 ).millis())
              .set('system:time_end',ee.Date.fromYMD(2030, 12, 31 ).millis());
var RURALMASK = ee.Dictionary({GHSL: ee.Dictionary({data:ee.ImageCollection('JRC/GHSL/P2016/SMOD_POP_GLOBE_V1'), scale: 1000, coef:1}),
                 WORLDPOP: ee.Dictionary({data:empty_mask, scale:1, coef:1}),
                 GPW: ee.Dictionary({data:empty_mask, scale:1, coef:1}),
                 FACEBOOKAI: ee.Dictionary({data:empty_mask, scale:1, coef:1})});

//Use dataset USDOS LSIB 2017
//var COUNTRY_DATASET = ee.FeatureCollection('USDOS/LSIB/2017');
var COUNTRY_DATASET = {data:ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017'), scale: 100};
//
var app = {};
app.AreaScale = 30;
//var app.country_name_key = 'COUNTRY_NA'
app.country_name_key = 'country_na';
app.defaultCountry = 'Namibia';
app.defaultRegion = 'All';
app.rangeType = 'Yearly';
app.defaultYear = '2015';
app.defaultAssetName = 'users/' + CONFIG.USER + '/NAMIBIA_Regional_Boundaries_2014';
app.defaultUseWater = false; //use water dataset to account for inaccessible roads
app.defaultUseDEM = false; //use DEM to account for terrain in evaluating distances
app.defaultMaxRuralDensity = 300; //max rural population density in inhabitants/km2
//
app.performSegmentation = 0; //perform segementation on population dataset if no rural mask exist
app.SNIC_size = 1000;//seed location in meters
app.SNIC_compactness = 1;
//
app.defaultRegionID = 11;
app.defaultDist2Road = 2000;
app.availableYears = ['2010','2011','2015','2016','2018'];//['1990','2000','2005','2010','2015','2020'];//Array.apply(null, {length: 28}).map( function(number, index){return (1990+index).toString()});//['1990','2000','2010','2011','2015'];
//
app.defaultPopAsset = '';
app.defaultRuralAsset = '';//'users/' + CONFIG.USER + '/NAMIBIA_Omaheke_Rural_Urban_Mask';
//CRS
app.EXPORT_CRS = 'EPSG:4326';
/***********************************************************************************/
app.Mosaic_layer = {
  name: 'RAI_distrib',
  visParam : {min:0, max:100, palette:['ffffff','f5f186','f4ce5c','eaa537','a65325','690c0e']},
  legend: {type:'continuous', title: 'RAI(%)'}  
  };
app.layerProperties = {
    name: 'waterClass',
    visParam: {min: 0, max: 3, palette: ['white', 'cyan', 'blue']},
    legend: {type:'discrete', style:[{'Rural': 'red'}, {'Road': 'black'}, {'Road Buffer': 'gray'}]},
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
/******************************************************************************
 * Calculate Rural Masl
*******************************************************************************/
var calculateRuralMask = function(popmap, Polygon){
  
  var map_scale = popmap.get('scale');
  popmap = popmap/*.clip(Polygon)*/.rename('population_count');
  popmap = popmap.addBands(ee.Image.pixelArea().clip(Polygon).rename('area'));
  //calculate clusters
  var urban_cluster_snic = ee.Algorithms.Image.Segmentation.SNIC({
    image:popmap,
    size: ee.Number(app.SNIC_size).divide(map_scale).add(1).round(),
    compactness:app.SNIC_compactness,//value ok
    connectivity:8}); //no seeds, results appears worse
  var density = urban_cluster_snic.select('population_count_mean')
    .divide(urban_cluster_snic.select('area_mean')).rename('density');
  // Define a kernel.
 //var kernel = ee.Kernel.circle({radius: 100, units:'meters'});
  //remove value with density>300 inhab/km2 = 0.0003 inhab/m2
  return density.lte(app.defaultMaxRuralDensity/1000000.0)
    //close filter
   //.focal_min({kernel: kernel, iterations: 2})
   //.focal_max({kernel: kernel, iterations: 2})
  .set('source','SNIC');
};
/******************************************************************************
 * Extract Rural mask from GHSL
*******************************************************************************/
var getRuralMask = function(dateStart, dateEnd, Popmap, Polygon, DB_name){

  DB_name = 'GHSL';
  var rural_dict = ee.Dictionary(RURALMASK.get(DB_name)).get('data');
  rural_dict = ee.ImageCollection(rural_dict).filter(ee.Filter.date(dateStart, dateEnd)).first();

  var settlement = ee.Image( ee.Algorithms.If(ee.String(app.defaultRuralAsset).length(),
    ee.Image(app.defaultRuralAsset).unmask().eq(0).selfMask().set('source','GEEasset'),
    rural_dict.set('source',DB_name)) );
  
  return settlement.clip(Polygon).lte(1.0).copyProperties(settlement);
};

/******************************************************************************
 * Calculate Rural Mask. Rural = non Urban = less than 300inhab per km2
*******************************************************************************/
var CalcRuralMask = function(popmap, poly, dateStart, dateEnd){
  var band_name = ee.String(popmap.bandNames().get(0)).toUpperCase();
  
  var condition = ee.Number(app.performSegmentation).eq(0);

  //Return the most appropriate mask
  var rural_mask = ee.Image(ee.Image( ee.Algorithms.If( condition,
      getRuralMask(dateStart, dateEnd, popmap, poly, band_name), 
      calculateRuralMask(popmap, poly) ))
    .rename(band_name)
    .copyProperties(popmap));
    
  return rural_mask.updateMask(rural_mask.gt(0))
    .copyProperties(popmap)
    .copyProperties(rural_mask);//Mask 1's as they means no change to the population distribution
};
/******************************************************************************
 * 
*******************************************************************************/
var CalcRAI = function(Year, CountryAbbr, lRegion){
  
  var yearRange, regionRange;
  var yearly_trend = true;
  if(app.rangeType=='Yearly'){
    yearly_trend = true;
    yearRange = Year;
    regionRange = lRegion;//[app.defaultRegion];
  }else if(app.rangeType=='Regional' && GUI_AOI.selectedGEEAsset()===false){
    yearly_trend = false;
    HELP.show_help_panel('Regional trend for the year ' + app.defaultYear);
    //Years and months to consider
    yearRange = [app.defaultYear];
    regionRange = lRegion;//app.RegionLst.slice(1);//skip the first "region" which is "all"
  }else{
    HELP.show_help_panel('Incorrect Location/Trend mode combination!');
    return {};	
  }
  //LOOP
  var PolygonLst = ee.List([]);
  var result = ee.List([]);
  //Generate list of polygons
  regionRange.forEach( function(region){
    var p = AOI.GetClippingPolygon(GUI_AOI.countryName, region, GUI_AOI.AssetName, GUI_AOI.RegionID);
    var v = ee.Dictionary({region: ee.String(region), poly:ee.Geometry(p.polygon), outline:ee.Geometry(p.outline)});
    PolygonLst = PolygonLst.add( v );
  });
  //
  var useGlobalDataset = 1;
  var geeAssetPop;
  if(population_GEEasset.getValue()){
    useGlobalDataset = 0;
    var scale = Number(pop_reso_textbox.getValue()); 
    var ruralscale =  Number(ruralmask_reso_textbox.getValue()); 
    print('Imported Population dataset will be used. Scale=' + scale);
    //-- loaded Asset
    geeAssetPop = ee.Image(app.defaultPopAsset)
      .set('scale',scale,'database','GEEasset','name','Imported Asset').rename('GEEasset');
    geeAssetRuralMask = ee.Image(app.defaultRuralAsset)
      .set('scale',scale,'database','GEEasset','name','Imported Asset').rename('GEEasset');      
    yearRange = [app.defaultYear];
  }else{
    geeAssetPop = ee.Image.constant(0).set('scale',100000,'database','undef','name','undef').rename('undef');
  }
  //
  var zeroImg = ee.Image.constant(0).selfMask();
  var oneImg  = ee.Image.constant(1);
  //Loop over regions
  result = PolygonLst.map(function(Polygon){
    var poly = ee.Geometry(ee.Dictionary(Polygon).get('poly'));
    var outline = ee.Geometry(ee.Dictionary(Polygon).get('outline'));
    var region_name = ee.Dictionary(Polygon).get('region');
    var area = ee.Image.pixelArea().clip(poly);
    /*--------------------------------------------------------
    * Retrieve road network
    --------------------------------------------------------*/
    var RoadNetwork = GUI_AOI.ROAD_DATASET.data.clip(poly);
    /*--------------------------------------------------------
    * Raster road network
    --------------------------------------------------------*/
    var RoadImg = RoadNetwork
      .focal_max(app.defaultDist2Road, 'circle','meters')
      .gt(0)
      .reproject({scale:500, crs:app.EXPORT_CRS});
      
    //loop over years
    var res_year = ee.List(yearRange).map(function(year){

      var DateStart = ee.String(year).cat('-01-01');
      var DateEnd = ee.String(year).cat('-12-31');
      
      /*--------------------------------------------------------
      * Retrieve Global population dataset:
      *   Censuses
      * or
      *   WorldPop, Landscan of OakRidge, GRUMP
      ---------------------------------------------------------*/
      var PopMap;
      //-- GHSL 
      var ghslPop = POP.GHSL.data
        .filterBounds(poly)
        .filter(ee.Filter.date( DateStart, DateEnd ));
      ghslPop = ee.Image(ee.Algorithms.If( ghslPop.size(),
          ghslPop.first().multiply(POP.GHSL.coef).set('scale', POP.GHSL.scale), 
          zeroImg.set('scale',10000) ))
        .clip(poly)
        .set('database','GHSL','name','GHSL')
        .rename('GHSL');//band name must match <database>       

      //-- WorldPop
      var worldPop = POP.WORLDPOP.data
        .filterBounds(poly)
        .filter(ee.Filter.eq('country',CountryAbbr))
        .filter(ee.Filter.eq('year',ee.Number.parse(year)))
        .filter(ee.Filter.date( DateStart, DateEnd ))
        .filter(ee.Filter.eq('UNadj','no'));
      worldPop = ee.Image(ee.Algorithms.If( worldPop.size(),
          worldPop.first().multiply(POP.WORLDPOP.coef).set('scale', POP.WORLDPOP.scale), 
          zeroImg.set('scale',10000) ))
        .clip(poly)
        .set('database','worldPop','name','World Pop')
        .rename('worldPop');//band name must match <database>       
        
      //-- GPW
      var gpwPop = POP.GPW.data
        .filter(ee.Filter.date( DateStart, DateEnd ))
        .filterBounds(poly);
      gpwPop = ee.Image(ee.Algorithms.If( gpwPop.size(),
          gpwPop.first().multiply( POP.GPW.coef).set('scale', POP.GPW.scale), 
          zeroImg.set('scale',10000) ))
        .clip(poly)
        .set('database','gpw','name','GPW')
        .rename('gpw');//band name must match <database>       
        
      //-- Facebook Pop
       var facebookPop = POP.FACEBOOKAI.data
        .filterBounds(poly)
        .filter(ee.Filter.date( DateStart, DateEnd ));
      facebookPop = ee.Image(ee.Algorithms.If( facebookPop.size(),
          facebookPop.first().multiply(POP.FACEBOOKAI.coef).set('scale', POP.FACEBOOKAI.scale), 
          zeroImg.set('scale',10000) ))
        .clip(poly)
        .set('database','facebookai','name','Facebook AI')
        .rename('facebookai');//band name must match <database>        

      /*--------------------------------------------------------
      * Image collection of all population dataset
      *   update the mask
      ---------------------------------------------------------*/
      PopMap = ee.ImageCollection.fromImages( ee.Algorithms.If(useGlobalDataset,
        [worldPop, gpwPop, ghslPop, facebookPop],
        [geeAssetPop]));

      /*--------------------------------------------------------
      * Retrieve Settlement dataset to identify rural areas
      ---------------------------------------------------------*/
      //Calculate Rural Mask for each image population
      var RuralMask = PopMap.map( function(img){  return CalcRuralMask(img, poly, DateStart, DateEnd);} );

      /*--------------------------------------------------------
      * City Access
      --------------------------------------------------------*/
      //var cityAccess = CITYACCESS_DATASET.filter(ee.Filter.date(DateStart, DateEnd));
      
      /*--------------------------------------------------------
      * Retrieve water dataset
      --------------------------------------------------------*/
      var ImgWaterRegion = WATER_DATASET.data
        .filterBounds(poly)
        .filter(ee.Filter.date(DateStart, DateEnd ))
        .select('waterClass');
        
      var WaterMask = ee.Image(ee.Algorithms.If( ImgWaterRegion.size(),
          ImgWaterRegion.first(), zeroImg ))
        .clip(poly).unmask().gt(1.0).rename('WaterMask');
        
      /*--------------------------------------------------------
      * Retrieve DEM dataset
      --------------------------------------------------------*/
       //the DEM is used to increase the cost=distance=pixel size * sqrt(1+slope^2)
      var dem = ee.Algorithms.Terrain(DEM_DATASET.data.clip(poly));
      var walking_width = ee.Image(
        ee.Algorithms.If(app.defaultUseDEM,
          dem.select('slope').polynomial([1.0,0,1.0]).sqrt(),
          oneImg.clip(poly) ) 
        ).lte(1);
      var RoadImg_mask = RoadImg.multiply(walking_width);
      
      /*--------------------------------------------------------
      * Retrieve road conditions
      --------------------------------------------------------*/      
      //Account for Water: Walkable area must no contain any water area:
      var nowater_road = ee.Image(ee.Algorithms.If(app.defaultUseWater,
          WaterMask.not(), oneImg.clip(poly)));
      RoadImg_mask = RoadImg_mask.multiply(nowater_road);
      
      /*----------------------------------------------------------
      //Now need to overlap this layer with the road layer.
      //The overlap region give the number of units having access to a road <2km away
      ----------------------------------------------------------*/
      /*----------------------------------------------------------
      * Update PopMap with rural , access maps and stats
      ----------------------------------------------------------*/
      PopMap = PopMap.map(function(img){
        var bandname = img.bandNames().get(0);
        var mask = RuralMask.filterMetadata('database','equals',bandname).first();
        img = img.rename('total');
        //Calculate rural population maps
        var rural = ee.Image(img.select('total').multiply(mask)).rename('rural');
        //img = img.addBands( rural );
        //Calculate access to road
        var access = rural.updateMask(RoadImg).rename('access');
        //img = img.addBands( access );
        //Calculate stats
        var map_scale = ee.Image(img).get('scale');
        var stat_total = img.reduceRegion({reducer:'sum', geometry: poly, scale: map_scale, maxPixels: 1e12}).get('total');
        var stat_rural = rural.reduceRegion({reducer:'sum', geometry: poly, scale: map_scale, maxPixels: 1e12}).get('rural');
        var stat_access = access.reduceRegion({reducer:'sum', geometry: poly, scale: map_scale, maxPixels: 1e12}).get('access');
        
        var rai = ee.Number(stat_access).multiply(100).divide(stat_rural);
        return img
          .addBands( rural )
          .addBands( access )
          .set('total_pop',stat_total)
          .set('rural_pop',stat_rural)
          .set('access_pop',stat_access)
          .set('RAI',rai)
          .set('source', mask.get('source'));
      });
      //
      //create map of RAI
      var rai = ee.List(PopMap.aggregate_array('RAI'));
      var database = ee.List(PopMap.aggregate_array('database'));
      var valued_poly = ee.List.sequence(0, null, 1,rai.length() )
        .map( function(i) {  return  ee.Image([]).addBands( ee.Image.constant(rai.get(i)).clip(poly).rename([database.get(i)]) ); })
        .iterate( function(cur, prev) { return ee.Image(prev).addBands(cur);  }, ee.Image.constant(0) );
      //return dictionary with all values
      return ee.Dictionary({
        //data
        year: year,
        //boynding area
        BoundaryPolygon: poly,
        Outline: outline,
        region: region_name,
        //Road network
        RoadImg:RoadImg_mask,
        RoadNetwork:RoadNetwork,
        //Population datasets: total, rural, within **km of a road
        PopMap:PopMap.map( function(img){return img.select('total')}).toBands().rename(database),
        RuralMap:PopMap.map( function(img){return img.select('rural')}).toBands().rename(database),
        AccessMap:PopMap.map( function(img){return img.select('access')}).toBands().rename(database),
        //Masks: rural mask, Walkable area, water
        RuralMask: RuralMask.toBands().rename(database),
        WaterMask:WaterMask,
        WalkingWidth:walking_width,
        //Statistics
        DB_description: ee.Dictionary.fromLists(database, ee.List(PopMap.aggregate_array('name'))),
        pop_within_dist: ee.Dictionary.fromLists(database, ee.List(PopMap.aggregate_array('access_pop'))),
        total_stats: ee.Dictionary.fromLists(database, ee.List(PopMap.aggregate_array('total_pop'))),
        rural_stats: ee.Dictionary.fromLists(database, ee.List(PopMap.aggregate_array('rural_pop'))),
        ruralSource: ee.Dictionary.fromLists(database, ee.List(PopMap.aggregate_array('source'))),
        RAI: ee.Dictionary.fromLists(database, rai),
        valued_poly: valued_poly
      });
    }).flatten();
    return res_year;
  }).flatten();

  //Generate map time series
  var TimeSeriesMap;
  if(yearly_trend){
    TimeSeriesMap = result.map(function(r){return ee.Dictionary(r).get('RuralMap');});
  }else{
    TimeSeriesMap = result.map(function(r){return ee.Image(ee.Dictionary(r).get('valued_poly')).toFloat();});
  }  
  TimeSeriesMap = ee.ImageCollection.fromImages(TimeSeriesMap);
  //
  return {data:ee.List(result), TimeSeriesMap:TimeSeriesMap};
};

/****************************************************************************************
* Display water layer for the selected year and region
*****************************************************************************************/
var DisplayPopLayer = function(){
  //Clear Map
  ClearMap();
  //Clear Result Panel
  ClearresultPanel();
  LEGEND.setLegend(app.layerProperties, GUIPREF);
  //-----------------------------------------------------------------------------------
  var countryAbbr = AOI.countryCode(GUI_AOI.countryName);
  
  var alldata = CalcRAI([app.defaultYear], countryAbbr, [GUI_AOI.regionName]);
  if( Object.keys(alldata).length===0 ){return;}
  var data = ee.Dictionary(alldata.data.get(0));
  //retrieve calculated data
  var time_range = data.get('year').getInfo();
  var DBlst = data.get('DB_description').getInfo();
  var total_stats = data.get('total_stats').getInfo();
  var rural_stats = data.get('rural_stats').getInfo();
  var pop_within_dist = data.get('pop_within_dist').getInfo();
  var ruralSource = data.get('ruralSource').getInfo();

  /*------------------------------------------------------
  * Plots MAPS
  ------------------------------------------------------*/
  //AOI: Outline
  var Outline = alldata.data.map(function(r){return ee.Geometry(ee.Dictionary(r).get('Outline'));}).flatten();
  Outline = Outline.slice(1).iterate(function(cur, prev){return ee.Geometry(prev).union(ee.Geometry(cur));},
    Outline.get(0));  
  //Add region outline to map  
  mapPanel.add(ui.Map.Layer(ee.Geometry(Outline), {}, 'Region'));

  //Plot road network
  mapPanel.addLayer( ee.Image(data.get('RoadNetwork')), {color:'ff0000'}, 'Road Network', true);  

  //Plot rural clusters
  mapPanel.addLayer(ee.Image(data.get('RuralMask')), {min:0, max:1, opacity:1.0}, 'Rural Mask', false);

  //Plot water area
  mapPanel.addLayer(ee.Image(data.get('WaterMask')),{palette:'0000ff'}, 'Water', false);
    
  //Plot water area
  mapPanel.addLayer(ee.Image(data.get('WalkingWidth')),{palette:'0000ff'}, 'WalkingWidth', false);    

  // ** Processed **
  var rural_map_visParam = {min:0, palette: ["#ffffff","#ff00d3"]};
  //Rural population
  mapPanel.addLayer(ee.Image(data.get('RuralMap')), 
    {}, 
    'Rural population',false); 

  //2km or 5km thickness applied to the roads
  mapPanel.addLayer(ee.Image(data.get('RoadImg')), {color:'ff0000', opacity:0.5}, 
    (app.defaultDist2Road/1000) + 'km Roads Buffer', true);  

  //Plot population
  mapPanel.addLayer(ee.Image(data.get('PopMap')), {}, 'Population',false);

  //Plot access to road
  mapPanel.addLayer(ee.Image(data.get('AccessMap')), {}, 'Access to Road');

  //-Results
  var ROI;
  if(  GUI_AOI.selectedGEEAsset()===false ){
    ROI = GUI_AOI.countryName + '-' + GUI_AOI.regionName;
  }else{
    ROI = 'ShapeFile';
  }
  //Generate information text 
  var text1='', text2='', text3='';
  for(var key in DBlst){
    if(total_stats[key]>0){
      text1 = text1 + '* ' + (total_stats[key]).toFixed(0) + ' (' + DBlst[key] + ')\n';
      
      var p1 = 100.0*(rural_stats[key])/(total_stats[key]);
      text2 = text2 + '* ' + (rural_stats[key]).toFixed(0) + ' inhab. (' + 
        p1.toFixed(2) + '% of the total pop.) ' + ' (' + DBlst[key] + ')[' + ruralSource[key] + ']\n';     
          
      if(rural_stats[key]>0){
        var r1 = 100.0*(pop_within_dist[key])/(rural_stats[key]);
        text3 = text3 + '* ' + (pop_within_dist[key]).toFixed(0) + ' inhab. (' +
          r1.toFixed(2) + '% of the rural pop.) '  + ' (' + DBlst[key] + ')\n';
      }
    }
  }
  //------------------------------------------------------------- Total population stat
  resultPanel.widgets().set(1,
    ui.Label('Global Population Count in ' + ROI + ' in ' + time_range + ': ', 
    {fontWeight: 'bold', color:GUIPREF.TEXTCOLOR}));    
  resultPanel.widgets().set(2,ui.Label(text1,{color:GUIPREF.TEXTCOLOR, whiteSpace:'pre'}));
    
  //------------------------------------------------------------- Rural population stat
  resultPanel.widgets().set(3, ui.Label(
    'Rural Population Count in ' + ROI + ' in ' + time_range + ': ', 
    {fontWeight: 'bold', color:GUIPREF.TEXTCOLOR}) );
  resultPanel.widgets().set(4,ui.Label(text2,{color:GUIPREF.TEXTCOLOR, whiteSpace:'pre'}));
  
  //------------------------------------------------------------- RAI
  if(text3.length>0){
    resultPanel.widgets().set(5,ui.Label(
      'Proportion living within ' + (app.defaultDist2Road/1000) + 'km of a road: ',
      {fontWeight: 'bold', color:GUIPREF.TEXTCOLOR}));  
    resultPanel.widgets().set(6,ui.Label(text3,{color:GUIPREF.TEXTCOLOR, whiteSpace:'pre'}));
  }
  
  resultPanel.style().set('height','350px','width','500px');
  resultPanel.style().set('shown',true);
};
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
      dataTable[n+1][i] = YListDict[n][key];
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
/****************************************************************************************
* Plot statistics area over time period
*****************************************************************************************/
var plotTrend = function(){
  //clear map
  ClearMap(); 
  //clear result Panel
  ClearresultPanel();
  //
  var options;
  var dataTable;
  var i, key;
  //
  var alldata = CalcRAI(app.availableYears, AOI.countryCode(GUI_AOI.countryName), 
    GUI_AOI.RegionLst.slice(1));//skip the first "region" which is "all"
  if( Object.keys(alldata).length===0 ){return;}
  //AOI: Outline
  var Outline = alldata.data.map(function(r){return ee.Geometry(ee.Dictionary(r).get('Outline'));}).flatten();
  Outline = Outline.slice(1).iterate(function(cur, prev){return ee.Geometry(prev).union(ee.Geometry(cur));},
    Outline.get(0));  

  //RAI
  var RAI = alldata.data.map(function(d){return ee.Dictionary(d).get('RAI')}).getInfo();
  //Total Pop
  var total_stats = alldata.data.map(function(d){return ee.Dictionary(d).get('total_stats')}).getInfo();  
  //Rural Pop
  var rural_stats = alldata.data.map(function(d){return ee.Dictionary(d).get('rural_stats')}).getInfo();  
  //get list of population database used
  var DBlst = alldata.data.map(function(d){return ee.Dictionary(d).get('DB_description')}).getInfo();
  //Get list of regions
  var RegionLst = alldata.data.map(function(d){return ee.Dictionary(d).get('region')}).getInfo();
  //
  if(app.rangeType=='Yearly' || GUI_AOI.selectedGEEAsset()===true){
    //Create series name
    dataTable = [ ['Year'] ];	
    i=1;
    for(key in DBlst[0]){
      dataTable[0][i] = DBlst[0][key];
      i++;
    }
    //Total Population
    var PopArray = Dict2Array(app.availableYears, total_stats, dataTable);
    options = {
      title: 'Total Population',
      vAxis: {title: 'Nb. Inhabitants',logScale: false  },
      legend: {position: 'bottom'},
      hAxis: {title: 'Year',logScale: false  }
    };
    var PopChart = ui.Chart(PopArray, 'ColumnChart', options);
    resultPanel.widgets().set(1, PopChart);

    //Rural population
    var RurArray = Dict2Array(app.availableYears, rural_stats, dataTable);
    options = {
      title: 'Rural Population',
      vAxis: {title: 'Nb. Inhabitants',logScale: false  },
      legend: {position: 'bottom'},
      hAxis: {title: 'Year',logScale: false  }
    };
    var RurChart = ui.Chart(RurArray, 'ColumnChart', options);
    resultPanel.widgets().set(2, RurChart);

    //RAI
    var RAIArray = Dict2Array(app.availableYears, RAI, dataTable);
    options = {
      title: 'Rural Access Index',
      vAxis: {title: 'RAI (%)',logScale: false  },
      legend: {position: 'bottom'},
      hAxis: {title: 'Year',logScale: false  }
    };
    var RAIChart = ui.Chart(RAIArray, 'ColumnChart', options);
    resultPanel.widgets().set(3, RAIChart);
    
    // Visualization and animation parameters.
    var params = {
      crs: app.EXPORT_CRS,
      framesPerSecond: 4,
      region: ee.Dictionary(alldata.data.get(0)).get('BoundaryPolygon'),
      min: 0.0,
      max: 1.0,
      palette: ['silver', 'white', 'cyan', 'blue'],
      dimensions: 512
    };
    resultPanel.widgets().set(4, ui.Thumbnail(alldata.TimeSeriesMap, params));
    //---------------------------------------------------
    resultPanel.style().set('shown',true);
    resultPanel.style().set('height','500px');
  }else if(app.rangeType=='Regional' && GUI_AOI.selectedGEEAsset()===false){
    //Plot RAI per region on the map
    app.Mosaic_layer.visParam.bands = Object.keys(DBlst[0])[0];
    mapPanel.add(ui.Map.Layer( alldata.TimeSeriesMap.mosaic(), 
      app.Mosaic_layer.visParam, app.Mosaic_layer.name, true));
      //
    mapPanel.add(ui.Map.Layer( alldata.TimeSeriesMap, 
      {}, 'Regional RAI', false));      
    
    //Create legend
    LEGEND.setLegend(app.Mosaic_layer, GUIPREF);

    //Create summary panel
    var Info = ui.Label('Regional Road access statistics during ' + app.defaultYear + ':\n');
    //Create series name
    dataTable = [ ['Region'] ];	
    i=1;
    for(key in DBlst[0]){
      dataTable[0][i] = DBlst[0][key];
      i++;
    }
    var RegionalRAIArray = Dict2Array(RegionLst, RAI, dataTable);
    
    // Define a dictionary of customization options.
    options = {
      title: 'Regional Statistics',
      vAxis: {title: 'RAI (%)',logScale: false  },
      legend: {position: 'bottom'},
      hAxis: {title: 'Region',logScale: false  }
    };
    //
    var chart = ui.Chart(RegionalRAIArray, 'ColumnChart', options);
    resultPanel.widgets().set(1, Info);
    resultPanel.widgets().set(2, chart);
    resultPanel.style().set('shown',true);
    resultPanel.style().set('height','300px');
  }
  //Add region outline to map  
  mapPanel.add(ui.Map.Layer(ee.Geometry(Outline), {}, 'Region'));
};

/****************************************************************************************
* Plot water area over time period
*****************************************************************************************/
var exportMap = function(){
  var description = 'RAI_map_for_' + GUI_AOI.RegionID + '_' + app.defaultYear;
  var poly = AOI.GetClippingPolygon(GUI_AOI.countryName, GUI_AOI.regionName, app.AssetName, GUI_AOI.RegionID);
  
  EXPORT_MAP.exportMap(mapPanel, description, app.AreaScale, poly.polygon, app.EXPORT_CRS)
};

/*=======================================================================================
                                           GUI
=======================================================================================*/
ui.root.setLayout(ui.Panel.Layout.flow('horizontal'));

/****************************************************************************************
* Help panel 
*****************************************************************************************/
HELP.createHelpBox('This App can be used to evaluate the access to roads and evaluate UN SDG Indicator 9.1.1', GUIPREF);

/*---------------------------------------------------------------------------------
* Create a control panel.
---------------------------------------------------------------------------------*/
var header = ui.Label('SDG 9.1.1: Rural Access Index', GUIPREF.TITLE_STYLE);
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
var yearSelect = ui.Select({
  items: app.availableYears,
  value: app.availableYears[0],
  style: GUIPREF.SELECT_STYLE,
  onChange: function(year) {
    app.defaultYear = year;
  }
});

// Add the select to the toolPanel with some explanatory text.
var yearPanel = ui.Panel(
  [ui.Label( 'Period:', GUIPREF.LABEL_T_STYLE),
  ui.Panel([ui.Label('Year:', GUIPREF.LABEL_STYLE),yearSelect],
  ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE)],
  ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE);

/******************************************************************************************
* GUI: Selection of a predefined shape.
******************************************************************************************/
GUI_AOI.createGUI(mapPanel, HELP, AOI, GUIPREF, app.defaultCountry, app.defaultRegion);
var LocationPanel = GUI_AOI.LocationPanel;
mapPanel.centerObject(ee.Geometry(GUI_AOI.Location.polygon));
GUI_AOI.setAsset(app.defaultAssetName,  app.defaultRegionID);

yearSelect.setValue(app.defaultYear);
/****************************************************************************************
* Setting of the definition of the indicator
* distance to road
* use of DEM
* no water
*****************************************************************************************/
//Distance to road
var RoadWidthSlider = ui.Select({
  items: ['2 km', '5 km'],
  value: '2 km',
  style: GUIPREF.SELECT_STYLE,
  onChange: function(width) {
    if(width=='2 km'){
      app.defaultDist2Road = 2000.0;
    }else{
      app.defaultDist2Road = 5000.0;
    }
  }
});
//edit box to define the maximum rural population density
var rural_textbox = ui.Textbox({
  placeholder: 'Max rural population density',
  style: GUIPREF.EDIT_STYLE,
  value: '300',
  onChange: function(text) {
    if((typeof text=='string' && text.length>0) || text>=0){
      app.defaultMaxRuralDensity = Number(text);
    }else{
      app.defaultMaxRuralDensity = 300;
    }    
    //clear map
    ClearMap(); 
    //clear result Panel
    ClearresultPanel();
  }
});
//edit box to define the population asset to use
GUIPREF.EDIT_STYLE.width = '200px';
var pop_textbox = ui.Textbox({
  placeholder: 'users/<username>/....',
  style: GUIPREF.EDIT_STYLE,
  value: '',
  onChange: function(text) {
    app.defaultPopAsset = text;
    if(text.length>0){
      population_gbl_data.setValue(false);
      population_GEEasset.setValue(true);
    }else{
      population_gbl_data.setValue(true);
      population_GEEasset.setValue(false);
    }
    //clear map
    ClearMap(); 
    //clear result Panel
    ClearresultPanel();
  }
});
var ruralmask_textbox = ui.Textbox({
  placeholder: 'users/<username>/....',
  style: GUIPREF.EDIT_STYLE,
  value: '',
  onChange: function(text) {
    app.defaultRuralAsset = text;
  }
});
pop_textbox.setValue(app.defaultPopAsset)
ruralmask_textbox.setValue(app.defaultRuralAsset);

//Checkbox to selecct how the rural mask is going to be generated
var perform_segmentation_ck = ui.Checkbox( {
  label:'Perform Segmentation on Pop. dataset', 
  value: app.performSegmentation, 
  style: GUIPREF.CKBOX_STYLE,
  onChange: function (value){
    app.performSegmentation = Number(value);
  }
});
var helpseg = HELP.helpButton('If selected, will perform segmentation on all the population dataset. Otherwise, the GHSL Settlement dataset will be used for all dataset, when available!');
//
var population_gbl_data = ui.Checkbox( {label:'Population Global Datasets', value: true, style: GUIPREF.CKBOX_STYLE} );
var population_GEEasset = ui.Checkbox( {label:'Population GEE Asset:', value: false, style: GUIPREF.CKBOX_STYLE} );
var help_popasset = HELP.helpButton('Enter a population dataset.');
var help_ruralmask_asset = HELP.helpButton('Enter a raster rural mask (0 in rural area, 1 in urban area).');
population_gbl_data.setDisabled(true);
population_GEEasset.setDisabled(true);
var rural_def = ui.Panel([ui.Label('Rural Definition:', GUIPREF.LABEL_T_STYLE),
    ui.Panel([rural_textbox, ui.Label('inhab./km2', GUIPREF.LABEL_STYLE)],ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE),
    ui.Panel([perform_segmentation_ck,helpseg],ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE)], 
  ui.Panel.Layout.Flow('vertical'), GUIPREF.CNTRL_PANEL_STYLE);

var PopulationPanel = ui.Panel([
      ui.Label( 'Population:', GUIPREF.LABEL_T_STYLE),
      population_gbl_data, 
      population_GEEasset,
      ui.Panel([ pop_textbox, help_popasset],ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE),
      ui.Panel([ ruralmask_textbox, help_ruralmask_asset],ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE),
      rural_def],
    'flow', GUIPREF.CNTRL_PANEL_STYLE);
//Indicator definition panel
var no_water_ck = ui.Checkbox( {label:'No water', value: false, style: GUIPREF.CKBOX_STYLE, onChange: function(v){app.defaultUseWater=v;}} );
var use_DEM_ck = ui.Checkbox( {label:'Include Terrain', value: false, style: GUIPREF.CKBOX_STYLE, onChange: function(v){app.defaultUseDEM=v;}} );
var DistPanel = ui.Panel([ui.Label( 'Indicator Definition:', GUIPREF.LABEL_T_STYLE), 
  ui.Panel([ui.Label( 'Distance to road:', GUIPREF.LABEL_STYLE), RoadWidthSlider],
  ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE), 
  ui.Panel([no_water_ck, use_DEM_ck,],ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE)],
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
var helpmap = HELP.helpButton('Update the map with the water layer calculated from the selected dataset, year and month. When Month="All", the yearly average is displayed.');
var genMapBtn = ui.Button( 'Update Map', DisplayPopLayer, false, GUIPREF.BUTTON_STYLE);
var mapCntrl = ui.Panel([genMapBtn, helpmap],ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE);
//-------------------------------------------------------------
var rangeTypeSelect = ui.Select({
  items: ['Yearly','Regional'],
  value: 'Yearly',
  style: GUIPREF.SELECT_STYLE,
  onChange: function(rt) {
    app.rangeType = rt;
  }
});
var helprange = HELP.helpButton('Generate a graph with the change in water quality over a time frame in years or months for the current year.'+
  '\nDisplay the extremum water quality loss and gain from the reference Year onwards.');
var genTrendBtn = ui.Button( 'Generate Trend', plotTrend, false, GUIPREF.BUTTON_STYLE);
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
var gpe_gee_info = ui.Label(
    'Global Population Explorer from GEE', 
    {backgroundColor: GUIPREF.BACKCOLOR},
    'https://google.earthengine.app/view/population-explorer');

var gsw_info = ui.Label(
    'GSW dataset: J.-F. Pekel, A. Cottam, N. Gorelick, A. S. Belward, "High-resolution mapping of global surface water and its long-term changes." Nature 540, 418-422 (2016).', 
    {backgroundColor: GUIPREF.BACKCOLOR},
    'https://www.nature.com/articles/nature20584');

var fbai_info = ui.Label(
    'Facebook AI African Population dataset', 
    {backgroundColor: GUIPREF.BACKCOLOR},
    'https://ai.facebook.com/blog/mapping-the-world-to-help-aid-workers-with-weakly-semi-supervised-learning');
	
var DEM_info = ui.Label('SRTM: Jarvis, A., H.I. Reuter, A. Nelson, E. Guevara. 2008. Hole-filled SRTM for the globe Version 4, available from the CGIAR-CSI SRTM 90m Data', 
  {backgroundColor: GUIPREF.BACKCOLOR}, 
  'http://srtm.csi.cgiar.org');
var GHSL_info = ui.Label('GHSL: Pesaresi, Martino; Freire, Sergio (2016): GHS Settlement grid following the REGIO model 2014 in application to GHSL Landsat and CIESIN GPW v4-multitemporal (1975-1990-2000-2015). European Commission, Joint Research Centre (JRC)', 
  {backgroundColor: GUIPREF.BACKCOLOR},
  'http://data.europa.eu/89h/jrc-ghsl-ghs_smod_pop_globe_r2016a');
var worldPop_info = ui.Label('WorldPop Dataset', 
  {backgroundColor: GUIPREF.BACKCOLOR}, 
  'http://www.worldpop.org');

var OSM_info = ui.Label('OpenStreetMap data', 
  {backgroundColor: GUIPREF.BACKCOLOR}, 
  'http://download.geofabrik.de/');
  
  var text = ui.Label(
  'Results based on OpenStreetMap data for Namibia only!',
  GUIPREF.LABEL_STYLE);

var referencePanel = ui.Panel([text, ui.Label('References and for more information', GUIPREF.LABEL_T_STYLE), 
  gpe_gee_info, GHSL_info, worldPop_info, fbai_info, OSM_info, DEM_info, gsw_info],'flow', GUIPREF.CNTRL_PANEL_STYLE);
/******************************************************************************************
* GUI: Screen layout
******************************************************************************************/
//result panel

//Tool panel
toolPanel.add(ui.Panel([ yearPanel, LocationPanel,
	DistPanel,
	PopulationPanel,
	trendPanel,exportPanel,
	viewPanel,
	mailPanel,referencePanel],
	ui.Panel.Layout.flow('vertical',true)));
//map panel
mapPanel.add(resultPanel)
//overall window
ui.root.widgets().reset([toolPanel, mapPanel]); 