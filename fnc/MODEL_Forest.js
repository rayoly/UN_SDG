
var datasets = {
  MODIS: 'MODIS/006/MOD13A2', //dataset: MODIS Terra Daily EVI
  S2: 'COPERNICUS/S2', //dataset, L1C: 'COPERNICUS/S2' from 2015, L2A: 'COPERNICUS/S2_SR' from 2017
};

//include modis land classification to extract water  mask
var FOREST_MASK = ee.ImageCollection('MODIS/006/MCD12Q1')
  .select('LC_Type1')
  .map(function(img){return img.lte(8);});


var EVI_min = 0.0;
var EVI_max = 1.0;

exports.set_EVI_Threshold = function(evimin, evimax){
  EVI_min = evimin;
  EVI_max = evimax;
}
/*---------------------------------------------------------------------------------------
* Cloud masking for MODIS
---------------------------------------------------------------------------------------*/
function maskMODISclouds(image) {
  var qa = image.select('SummaryQA');
  // good data
  var mask = qa.eq(0);
  return image.updateMask(mask).divide(10000);
}
/*---------------------------------------------------------------------------------------
* Cloud masking for S2
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
/*---------------------------------------------------------------------------------------
* Retrieve forest layer from MODIS
---------------------------------------------------------------------------------------*/
exports.MODIS = function(year, poly){
  var DateStart, DateEnd;
  var dataset, layer;
  var ImgForestRegion;
  
  year = ee.String(year);
  
  //load data
  var FOREST_DATASET = ee.ImageCollection(datasets.MODIS);
  
  //filter data by date
  DateStart = year.cat('-01-01');
  DateEnd = year.cat('-12-31');
  dataset = FOREST_DATASET.filter(ee.Filter.date(DateStart, DateEnd));
  dataset = dataset.select(['NDVI','EVI','SummaryQA'])
  //
  ImgForestRegion = ee.Image(ee.Algorithms.If(
        dataset.size(),
        ee.Image(dataset.select(['NDVI','EVI','SummaryQA']).map(maskMODISclouds).median()),
        ee.Image.constant(0).rename('NDVI').addBands(ee.Image.constant(0).rename('EVI'))
        ))
    .select(['NDVI','EVI'])
    .set('year',ee.Number.parse(year))
    .clip(poly.polygon);
    
  var EVI = ee.Image(ImgForestRegion).select('EVI');
  
  ImgForestRegion = ImgForestRegion.addBands(
    EVI.gte(EVI_min).and(EVI.lte(EVI_max))
    .selfMask()
    .rename('forest'),['forest'],true);
    
  return ImgForestRegion;
}

/*---------------------------------------------------------------------------------------
* Display forest layer from Sentinel-2 EVI
---------------------------------------------------------------------------------------*/
exports.S2 = function(S2_DWI_type, year, poly){
  var dataset, layer;
  var ImgForestRegion;
  
  year = ee.String(year);
  
  //Calculate EVI from Sentinel-2
  // Create an initial mosiac, which we'll visualize in a few different ways.
  dataset = ee.ImageCollection(datasets.S2)
      .filterDate(year.cat('-01-01'), year.cat('-12-31'))
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));        // Pre-filter to get less cloudy granules.

  var image = ee.Image(ee.Algorithms.If(
      dataset.size().neq(0),
      dataset.select(['B3','B8','B11','QA60'])
      .map(maskS2clouds)
      .median(),
      ee.Image.constant(0).rename('B3').addBands(ee.Image.constant(0).rename('B8')).addBands(ee.Image.constant(0).rename('B11')  )
      ))
  .set('year',ee.Number.parse(year))
  .clip(poly.polygon);

  //only interested in forest bodies --> EVI>(EVI_threshold) 
  //EVI = G * (NIR-RED) / (NIR + C1*RED - C2*BLUE + L)
  var EVI = image.expression('G*(NIR-RED)/(NIR+C1*RED-C2*BLUE+L)',
  { BLUE:image.select('B2'),
    RED:image.select('B4'),
    NIR:image.select('B8'),
    L: 1.0, 
    C1: 6.0,
    C2: 7.5,
    G: 2.5}).rename(['EVI']);
  
  //
  ImgForestRegion = EVI;//ImgForestRegion.addBands(EVI);
  //
  ImgForestRegion = ImgForestRegion.addBands(
    EVI.gte(EVI_min).and(EVI.lte(EVI_max))
    .selfMask() 
    .rename('forest'),['forest'],true);
  //
  return ImgForestRegion;
}