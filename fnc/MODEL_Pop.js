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

//Population dataset
//GHSL: Global Human Settlement Layers, Population Grid 1975-1990-2000-2015 (P2016)
//Dataset from facebook, ingested in asset population_AF_2018-10-01: https://ai.facebook.com/blog/mapping-the-world-to-help-aid-workers-with-weakly-semi-supervised-learning/
//https://data.humdata.org/dataset/highresolutionpopulationdensitymaps

var POP = { GHSL: {data:ee.ImageCollection('JRC/GHSL/P2016/POP_GPW_GLOBE_V1'), scale: 250}, //250m resolution
            WORLDPOP: {data:ee.ImageCollection("WorldPop/POP"), rural_mask:[], scale: 100},//100x100, 3arcsec
            GPW: {data:ee.ImageCollection("CIESIN/GPWv4/population-count"), scale: 1000}, //1000x1000, 30arcsec
            HRSL: {data:ee.ImageCollection.fromImages(ee.List([ee.Image('users/rayoly/population_AF_2018-10-01')
              .set('system:time_start',ee.Date.fromYMD(2018, 3, 1 ).millis())
              .set('system:time_end',ee.Date.fromYMD(2018, 12, 31 ).millis())])),	scale: 30}, //1 arcsec=30m
            };

var empty_mask = ee.ImageCollection([ee.Image([])])
              .set('system:time_start',ee.Date.fromYMD(1990, 3, 1 ).millis())
              .set('system:time_end',ee.Date.fromYMD(2030, 12, 31 ).millis());


var RURALMASK = ee.Dictionary({GHSL: ee.Dictionary({data:ee.ImageCollection('JRC/GHSL/P2016/SMOD_POP_GLOBE_V1'), scale: 1000}),
                 WORLDPOP: ee.Dictionary({data:empty_mask, scale:1}),
                 GPW: ee.Dictionary({data:empty_mask, scale:1}),
                 HRSL: ee.Dictionary({data:empty_mask, scale:1})});
                 
var PARAM = {
  SNIC_size:1000, 
  SNIC_compactness:1,
  MaxRuralDensity:300,
  UrbanRuralAsset:''};
  
//------------------------------------------------------------------------------
exports.setSNIC = function(size, compactness){
  print('SNIC Parameters: size=' + size + ', compactness=' + compactness);
  PARAM.SNIC_size = size;
  PARAM.SNIC_compactness = compactness;
}
exports.setMaxRuralDensity = function(m){
  print('Max Rural Density: ' + m);
  PARAM.MaxRuralDensity = m;
}
exports.setMinUrbanDensity = function(m){
  PARAM.MaxRuralDensity = m;
}

exports.setUrbanAsset = function(m){
  PARAM.UrbanRuralAsset = m;
}
exports.setRuralAsset = function(m){
  PARAM.UrbanRuralAsset = m;
}
/*------------------------------------------------------------------------------
*
------------------------------------------------------------------------------*/
exports.getPop = function(DateStart, DateEnd, poly, year, CountryAbbr, useGlobalDataset, geeAssetPop){
  
  var zeroImg = ee.Image.constant(0);

  //-- GHSL 
  var ghslPop = POP.GHSL.data
    .filterBounds(poly)
    .filter(ee.Filter.date( DateStart, DateEnd ));
  ghslPop = ee.Image(ee.Algorithms.If( ghslPop.size(),
      ghslPop.first().set('scale', POP.GHSL.scale), 
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
      worldPop.first().set('scale', POP.WORLDPOP.scale), 
      zeroImg.set('scale',10000) ))
    .clip(poly)
    .set('database','worldPop','name','World Pop')
    .rename('worldPop');//band name must match <database>       
    
  //-- GPW
  var gpwPop = POP.GPW.data
    .filter(ee.Filter.date( DateStart, DateEnd ))
    .filterBounds(poly);
  gpwPop = ee.Image(ee.Algorithms.If( gpwPop.size(),
      gpwPop.first().set('scale', POP.GPW.scale), 
      zeroImg.set('scale',10000) ))
    .clip(poly)
    .set('database','gpw','name','GPW')
    .rename('gpw');//band name must match <database>       
    
  //-- Facebook Pop / HRSL
   var HRSL_Pop = POP.HRSL.data
    .filterBounds(poly)
    .filter(ee.Filter.date( DateStart, DateEnd ));
  HRSL_Pop = ee.Image(ee.Algorithms.If( HRSL_Pop.size(),
      HRSL_Pop.first().set('scale', POP.HRSL.scale), 
      zeroImg.set('scale',10000) ))
    //.multiply(ee.Image.pixelArea())
    .clip(poly)
    .set('database','hrsl','name','HRSL')
    .rename('hrsl');//band name must match <database>        

  /*--------------------------------------------------------
  * Image collection of all population dataset
  *   update the mask
  ---------------------------------------------------------*/
  var PopMap = ee.ImageCollection.fromImages( ee.Algorithms.If(useGlobalDataset,
    [worldPop, gpwPop, ghslPop, HRSL_Pop],
    [geeAssetPop]));
  
  return PopMap;
}

/******************************************************************************
 * Calculate Rural Mask
*******************************************************************************/
var calculateRuralMask = function(popmap, Polygon, return_rural){
  
  var map_scale = popmap.get('scale');
  popmap = popmap/*.clip(Polygon)*/.rename('population_count');
  popmap = popmap.addBands(ee.Image.pixelArea().clip(Polygon).rename('area'));
  //calculate clusters
  var urban_cluster_snic = ee.Algorithms.Image.Segmentation.SNIC({
    image:popmap,
    size: ee.Number(PARAM.SNIC_size).divide(map_scale).add(1).round(),
    compactness:PARAM.SNIC_compactness,//value ok
    connectivity:8}); //no seeds, results appears worse
  var density = urban_cluster_snic.select('population_count_mean')
    .divide(urban_cluster_snic.select('area_mean')).rename('density');
  // Define a kernel.
 //var kernel = ee.Kernel.circle({radius: 100, units:'meters'});
  //remove value with density>300 inhab/km2 = 0.0003 inhab/m2
  return ee.Image(ee.Algorithms.If(return_rural,
    density.lte(PARAM.MaxRuralDensity/1000000.0),
    density.gte(PARAM.MaxRuralDensity/1000000.0)))
      //close filter
      //.focal_min({kernel: kernel, iterations: 2})
      //.focal_max({kernel: kernel, iterations: 2})
    .set('source','SNIC');
};
/******************************************************************************
 * Extract Rural mask from GHSL
*******************************************************************************/
var getRuralMask = function(dateStart, dateEnd, Popmap, Polygon, DB_name, return_rural){

  DB_name = 'GHSL';
  var rural_dict = ee.Dictionary(RURALMASK.get(DB_name)).get('data');
  rural_dict = ee.ImageCollection(rural_dict).filter(ee.Filter.date(dateStart, dateEnd));
  rural_dict = ee.Image( ee.Algorithms.If(rural_dict.size(),
        rural_dict.first().set('source',DB_name), 
        ee.Image.constant(0).set('source','No Rural Mask')) );

  var asset = ee.Algorithms.If(return_rural,
    ee.Image(PARAM.UrbanRuralAsset).unmask().eq(0).selfMask().set('source','GEEasset'),
    ee.Image(PARAM.UrbanRuralAsset).unmask().eq(1).selfMask().set('source','GEEasset')
    )

  var settlement = ee.Image( ee.Algorithms.If(ee.String(PARAM.UrbanRuralAsset).length(),
    asset,
    rural_dict) );
  
  return settlement.clip(Polygon).lte(1.0).copyProperties(settlement);
};

/******************************************************************************
 * Calculate Rural Mask. Rural = non Urban = less than 300inhab per km2
*******************************************************************************/
exports.CalcRuralMask = function(popmap, poly, dateStart, dateEnd, performSegmentation){
  //
  var band_name = ee.String(popmap.bandNames().get(0)).toUpperCase();
  
  var condition = ee.Number(performSegmentation).eq(0);

  //Return the most appropriate mask
  var rural_mask = ee.Image(ee.Image( ee.Algorithms.If( condition,
      getRuralMask(dateStart, dateEnd, popmap, poly, band_name, true), 
      calculateRuralMask(popmap, poly, true) ))
    .rename(band_name)
    .copyProperties(popmap));
    
  return rural_mask.updateMask(rural_mask.gt(0))
    .copyProperties(popmap)
    .copyProperties(rural_mask);//Mask 1's as they means no change to the population distribution
};

/******************************************************************************
 * Calculate Rural Mask. Rural = non Urban = less than 300inhab per km2
*******************************************************************************/
exports.CalcUrbanMask = function(popmap, poly, dateStart, dateEnd, performSegmentation){
  //
  var band_name = ee.String(popmap.bandNames().get(0)).toUpperCase();
  
  var condition = ee.Number(performSegmentation).eq(0);

  //Return the most appropriate mask
  var urban_mask = ee.Image(ee.Image( ee.Algorithms.If( condition,
      getRuralMask(dateStart, dateEnd, popmap, poly, band_name, false), 
      calculateRuralMask(popmap, poly, false) ))
    .rename(band_name)
    .copyProperties(popmap));
    
  return urban_mask.updateMask(urban_mask.gt(0))
    .copyProperties(popmap)
    .copyProperties(urban_mask);//Mask 1's as they means no change to the population distribution
};