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

var GUI_DATE = require('users/rayoly/SDG_APP:fnc/GUI_date.js');

/*var datasets = {
  GSW_yearly: {data:'JRC/GSW1_0/YearlyHistory', min_data_value: 1, band:'waterClass'},//dataset
  GSW_monthly:{data:'JRC/GSW1_0/MonthlyHistory', min_data_value: 1, band:'water'}, //dataset
  S2:{data:'COPERNICUS/S2_SR', min_data_value: 0, band:'water'}
}*/
var datasets = {
  GSW_yearly: {data:'JRC/GSW1_1/YearlyHistory', min_data_value: 1, band:'waterClass'},//dataset
  GSW_monthly:{data:'JRC/GSW1_1/MonthlyHistory', min_data_value: 1, band:'water'}, //dataset
  S2:{data:'COPERNICUS/S2_SR', min_data_value: 0, band:'water'}
}
var NDWI_threshold = 0.3;

/*---------------------------------------------------------------------------------------
* 
---------------------------------------------------------------------------------------*/
exports.set_NDWI_threshold = function(val){
  NDWI_threshold = val;
}
/*---------------------------------------------------------------------------------------
* Display water layer from GSW
---------------------------------------------------------------------------------------*/
exports.GSW = function(poly, month, year){
  var DateStart, DateEnd;

  year = ee.String(year);
  month = ee.String(month);
  month = ee.Number(ee.Algorithms.If(month.compareTo('All').eq(0),0,ee.Number.parse(month)));
  
  //filter data by date
  var dataset = ee.Algorithms.If(month.eq(0),
    ee.ImageCollection(datasets.GSW_yearly.data).filter(ee.Filter.date(year.cat('-01-01'), year.cat('-12-31'))),
    ee.ImageCollection(datasets.GSW_monthly.data).filterMetadata('year','equals',ee.Number.parse(year)).filterMetadata('month','equals',month)
  );
  var min_data_value = ee.Number(ee.Algorithms.If(month.eq(0),
    datasets.GSW_yearly.min_data_value,
    datasets.GSW_monthly.min_data_value
  ));
  var band_name = ee.String(ee.Algorithms.If(month.eq(0),
    datasets.GSW_yearly.band,
    datasets.GSW_monthly.band
  ));

  dataset = ee.ImageCollection(dataset);
  //
  var ImgWaterRegion = ee.Image(ee.Algorithms.If(
        dataset.size(),
        ee.Image(dataset.first()),
        ee.Image.constant(0).rename(band_name)
        ))
    .select(band_name)
    .set('year',ee.Number.parse(year))
    .set('month',month)
    .clip(poly);
    
  //mask no data region
  ImgWaterRegion = ImgWaterRegion.updateMask(ImgWaterRegion.gt(min_data_value));

  return ImgWaterRegion;
};
/*---------------------------------------------------------------------------------------
* Display water layer from Sentinel-2 NDWI
* ref: https://github.com/sentinel-hub/custom-scripts/blob/master/sentinel-2/ndwi/script.js
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
exports.S2 = function(poly, S2_DWI_type, month, year){
  var DateRange = GUI_DATE.DateRange(year, month);
  var DateStart = DateRange.get(0);
  var DateEnd = DateRange.get(1);
  month = ee.String(month);
  month = ee.Number(ee.Algorithms.If(month.compareTo('All').eq(0),0,ee.Number.parse(month)));

  var zeroImg = ee.Image.constant(0);

  // Create an initial mosiac, which we'll visualize in a few different ways.
  var dataset = ee.ImageCollection(datasets.S2.data)
      .filterDate(DateStart, DateEnd)
      .filterBounds(poly)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));        // Pre-filter to get less cloudy granules.

  var image = ee.Image(ee.Algorithms.If(
      dataset.size().neq(0),
      dataset//.select(['B3','B8','B11','QA60'])
      .map(maskS2clouds)
      .mosaic(),//median()
      zeroImg.rename('B3').addBands(zeroImg.rename('B8')).addBands(zeroImg.rename('B11')  )
      ))
  .set('year',ee.Number.parse(year))
  .set('month',ee.Number.parse(month))
  .clip(poly);
  
  //only interested in water bodies --> NDWI>(NDWI_threshold) 
	var NDWI = image.normalizedDifference(['B3', 'B8']);//McFeeters: (green-nir)/(green+nir) 
	//var NDWI = image.normalizedDifference(['B8', 'B11']);//GAO: (nir-swir)/(nir+swir) [-1,1]
	
  var ImgWaterRegion = image.addBands(NDWI.rename(['NDWI']));
  //water mask as for GSW
  ImgWaterRegion = ImgWaterRegion.addBands(
      NDWI.gte(NDWI_threshold)
      .multiply(ee.Number(3.0))
      .selfMask() 
      .rename(datasets.S2.band),[datasets.S2.band],true);
  //
  return ImgWaterRegion;
};
