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

exports.WATERMEAS = { 
  S3: {data:ee.ImageCollection("COPERNICUS/S3/OLCI"), scale: 300, factor:1.0}, //500x500, 36arcsec, 0.01 arcdeg
  S2: {data:ee.ImageCollection("COPERNICUS/S2/OLCI"), scale: 300, factor:1.0}, //500x500, 36arcsec, 0.01 arcdeg
  LST: {data:ee.ImageCollection("LANDSAT/LC08/C01/T2_SR"), scale: 3000, factor:1.0}, //500x500, 36arcsec, 0.01 arcdeg
};
exports.Algorithms = ['BOMBER','WISP','WASI'];
exports.Units = {Chla:'Chl-a [mg/m^3]', TSM:'TSM [g/m^3]', Turbidity:'TUR [FTU]'};
var app = {};

/*---------------------------------------------------------------------------------------
* Cloud masking for Sentinel-2
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
* Cloud masking for Sentinel-3
---------------------------------------------------------------------------------------*/
function maskS3clouds(image) {
  var qa = image.select('quality_flags');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var dubiousBitMask = 1 << 21; //Bit 21: Dubious
  var cirrusBitMask = 1 << 11;
  var waterPixel = 1 << 31;
  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(dubiousBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0))
      .and(qa.bitwiseAnd(waterPixel).eq(0));

  return image.updateMask(mask).divide(10000).copyProperties(image);
}
/*---------------------------------------------------------------------------------------
* Calculate the water quality indicators based on sensor S2
---------------------------------------------------------------------------------------*/
var S2_CHL_a = function(srcimg, param){
  return ee.Image(0).rename('Chla');
};
var S2_TSM = function(srcimg, param){
  return ee.Image(0).rename('TSM');
};
var S2_turbidity = function(srcimg, param)
{
  return ee.Image(0).rename('Turbidity');
};

/*---------------------------------------------------------------------------------------
* Calculate the water quality indicators based on sensor Landsat
---------------------------------------------------------------------------------------*/
var LST_CHL_a = function(srcimg, param){
  return ee.Image(0).rename('Chla');
};
var LST_TSM = function(srcimg, param){
  return ee.Image(0).rename('TSM');
};
var LST_turbidity = function(srcimg, param)
{
  return ee.Image(0).rename('Turbidity');
};
/*---------------------------------------------------------------------------------------
* Calculate the water turbidity based on sensor S3 OLCI
---------------------------------------------------------------------------------------*/
var S3_TSM = function(srcimg, param){
  
    //Calculate Chl-a
  srcimg = ee.ImageCollection.fromImages(
    srcimg.select(['Oa03_radiance','Oa04_radiance','Oa05_radiance','Oa06_radiance','Oa08_radiance'],
      ['Chla','Chla','Chla','Chla','Chla'])).max();

  return ee.Image(0.5).rename('TSM');
};

/*---------------------------------------------------------------------------------------
* Calculate the water turbidity based on sensor S3 OLCI
---------------------------------------------------------------------------------------*/
var S3_CHL_a = function(srcimg, param){
  //Sentinel-3
  /*Oa02_radiance	W m^-2 sr^-1 μm^-1	0.0133873	412.5nm/10nm  Yellow substance and detrital pigments (turbidity)
  Oa03_radiance	W m^-2 sr^-1 μm^-1	0.0121481	442.5nm/10nm	Chl absorption max., biogeochemistry, vegetation
  Oa04_radiance	W m^-2 sr^-1 μm^-1	0.0115198	490nm/10nm	High Chl, other pigments
  Oa05_radiance	W m^-2 sr^-1 μm^-1	0.0100953	510nm/10nm	Chl, sediment, turbidity, red tide
  Oa06_radiance	W m^-2 sr^-1 μm^-1	0.0123538	560nm/10nm	Chlorophyll reference (Chl minimum)
  Oa07_radiance	W m^-2 sr^-1 μm^-1	0.00879161	620nm/10nm	Sediment loading
  Oa08_radiance	W m^-2 sr^-1 μm^-1	0.00876539	665nm/10nm	Chl (2^nd Chl abs. max.), sediment, yellow substance/vegetation*/
  
  //Calculate Chl-a as max of all Chl-abs measurements
  srcimg = ee.ImageCollection.fromImages(
    [
      srcimg.select(['Oa03_radiance'], ['Chla']),
      srcimg.select(['Oa04_radiance'], ['Chla']),
      srcimg.select(['Oa05_radiance'], ['Chla']),
      srcimg.select(['Oa06_radiance'], ['Chla']),
      srcimg.select(['Oa08_radiance'], ['Chla'])
    ]).max();

  return ee.Image(srcimg).rename('Chla');
}
/*---------------------------------------------------------------------------------------
* Calculate the water turbidity based on sensor S3 OLCI
---------------------------------------------------------------------------------------*/
var S3_turbidity = function(srcimg, param){
  //Sentinel-3
  /*Oa02_radiance	W m^-2 sr^-1 μm^-1	0.0133873	412.5nm/10nm  Yellow substance and detrital pigments (turbidity)
  Oa03_radiance	W m^-2 sr^-1 μm^-1	0.0121481	442.5nm/10nm	Chl absorption max., biogeochemistry, vegetation
  Oa04_radiance	W m^-2 sr^-1 μm^-1	0.0115198	490nm/10nm	High Chl, other pigments
  Oa05_radiance	W m^-2 sr^-1 μm^-1	0.0100953	510nm/10nm	Chl, sediment, turbidity, red tide
  Oa06_radiance	W m^-2 sr^-1 μm^-1	0.0123538	560nm/10nm	Chlorophyll reference (Chl minimum)
  Oa07_radiance	W m^-2 sr^-1 μm^-1	0.00879161	620nm/10nm	Sediment loading
  Oa08_radiance	W m^-2 sr^-1 μm^-1	0.00876539	665nm/10nm	Chl (2^nd Chl abs. max.), sediment, yellow substance/vegetation*/
  
  //Calculate turbidity
  return ee.Image(srcimg.select(['Oa02_radiance'],['Turbidity']));
};

/*---------------------------------------------------------------------------------------
* Calculate an image collection,filtered for the date range of interest, and based on S3
* for the water quality
---------------------------------------------------------------------------------------*/
var getWaterQual_S3 = function(DateStart, DateEnd, poly, waterMask, algorithm){

  // Create an initial mosiac, which we'll visualize in a few different ways.
  var dataset = exports.WATERMEAS.S3.data
    .filterBounds(poly)
    .filterDate(DateStart, DateEnd)
    .map( function(img){return img.clip(poly).updateMask(waterMask)});
    
  var zero = ee.Image.constant(0).clip(poly);

  dataset = ee.ImageCollection(ee.Algorithms.If(
    dataset.size().neq(0),
    dataset/*.map(maskS3clouds)*/,
    ee.ImageCollection.fromImages([
      zero.rename('Oa02_radiance')//Yellow substance and detrital pigments (turbidity)
      .addBands(zero.rename('Oa03_radiance'))//Chl absorption max., biogeochemistry, vegetation
      .addBands(zero.rename('Oa04_radiance'))//High Chl, other pigments
      .addBands(zero.rename('Oa05_radiance'))//Chl, sediment, turbidity, red tide
      .addBands(zero.rename('Oa06_radiance'))//Chlorophyll reference (Chl minimum)
      .addBands(zero.rename('Oa07_radiance'))//Sediment loading
      .addBands(zero.rename('Oa08_radiance'))])  )//Chl (2^nd Chl abs. max.), sediment, yellow substance/vegetation
    );

  //Calculate turbidity
  dataset = dataset.map( function(img){
      var turbidity = S3_turbidity(img).rename('Turbidity');
      var TSM = S3_TSM(img).rename('TSM');
      var Chla = S3_CHL_a(img).rename('Chla');
      //
      return  Chla
        .addBands(TSM)
        .addBands(turbidity);
    }, false);
  
  return ee.ImageCollection(dataset)
    .set('scale',exports.WATERMEAS.S3.scale);
};

/*---------------------------------------------------------------------------------------
* Calculate an image collection,filtered for the date range of interest, and based on S3
* for the water quality
---------------------------------------------------------------------------------------*/
var getWaterQual_S2 = function(DateStart, DateEnd, poly, waterMask, algorithm){

  // Create an initial mosiac, which we'll visualize in a few different ways.
  var dataset = exports.WATERMEAS.S2.data
    .filterBounds(poly)
    .filterDate(DateStart, DateEnd)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))        // Pre-filter to get less cloudy granules.
    .map( function(img){return img.clip(poly).updateMask(waterMask)});

  var zero = ee.Image.constant(0).clip(poly);

  dataset = ee.ImageCollection(ee.Algorithms.If(
    dataset.size().neq(0),
    dataset.map(maskS2clouds),
    ee.ImageCollection.fromImages([
      zero.rename('B1')//0.0001	60 meters	443.9nm (S2A) / 442.3nm (S2B)	Aerosols
      .addBands(zero.rename('B2'))//0.0001	10 meters	496.6nm (S2A) / 492.1nm (S2B)	Blue
      .addBands(zero.rename('B3'))//0.0001	10 meters	560nm (S2A) / 559nm (S2B)	Green
      .addBands(zero.rename('B4'))//0.0001	10 meters	664.5nm (S2A) / 665nm (S2B)	Red
      .addBands(zero.rename('B5'))//0.0001	20 meters	703.9nm (S2A) / 703.8nm (S2B)	Red Edge 1
      .addBands(zero.rename('B6'))//0.0001	20 meters	740.2nm (S2A) / 739.1nm (S2B)	Red Edge 2
      .addBands(zero.rename('B7'))//0.0001	20 meters	782.5nm (S2A) / 779.7nm (S2B)	Red Edge 3
      .addBands(zero.rename('B8'))//0.0001	10 meters	835.1nm (S2A) / 833nm (S2B)	NIR
      .addBands(zero.rename('B8A'))//0.0001	20 meters	864.8nm (S2A) / 864nm (S2B)	Red Edge 4
      .addBands(zero.rename('B9'))//0.0001	60 meters	945nm (S2A) / 943.2nm (S2B)	Water vapor
      .addBands(zero.rename('B11'))//0.0001	20 meters	1613.7nm (S2A) / 1610.4nm (S2B)	SWIR 1
      .addBands(zero.rename('B12'))//0.0001	20 meters	2202.4nm (S2A) / 2185.7nm (S2B)	SWIR 2
      .addBands(zero.rename('AOT'))//0.001	10 meters		Aerosol Optical Thickness
      .addBands(zero.rename('WVP'))//cm			0.001	10 meters		Water Vapor Pressure. The height the water would occupy if the vapor were condensed into liquid and spread evenly across the column.
      .addBands(zero.rename('SCL'))//1	11		20 meters		Scene Classification Map (The "No Data" value of 0 is masked out)
      .addBands(zero.rename('TCI_R'))//10 meters True Color Image, Red channel
      .addBands(zero.rename('TCI_G'))//10 meters		True Color Image, Green channel
      .addBands(zero.rename('TCI_B'))//10 meters		True Color Image, Blue channel
      .addBands(zero.rename('MSK_CLDPRB'))//0	100		20 meters		Cloud Probability Map
      .addBands(zero.rename('MSK_SNWPRB'))//0	100		10 meters		Snow Probability Map
      .addBands(zero.rename('QA60'))])  )//60 meters		Cloud mask
    );

  //Calculate turbidity
  dataset = dataset.map( function(img){
      var turbidity = S2_turbidity(img).rename('Turbidity');
      var TSM = S2_TSM(img).rename('TSM');
      var Chla = S2_CHL_a(img).rename('Chla');
      //
      return  Chla
        .addBands(TSM)
        .addBands(turbidity);
    }, false);
  
  return ee.ImageCollection(dataset)
    .set('scale',exports.WATERMEAS.S2.scale);
};

/*---------------------------------------------------------------------------------------
*  
---------------------------------------------------------------------------------------*/
var getWaterQual_LST = function(DateStart, DateEnd, poly, waterMask, algorithm){
  
 // Create an initial mosiac, which we'll visualize in a few different ways.
  var dataset = exports.WATERMEAS.LST.data
    .filterBounds(poly)
    .filterDate(DateStart, DateEnd)
    .map( function(img){return img.clip(poly).updateMask(waterMask)});

  var zero = ee.Image.constant(0).clip(poly);

  dataset = ee.ImageCollection(ee.Algorithms.If(
    dataset.size().neq(0),
    dataset/*.map(maskS3clouds)*/,
    ee.ImageCollection.fromImages([
      zero.rename('B1')//B1:0.0001	0.435-0.451 μm - Band 1 (ultra blue) surface reflectance
      .addBands(zero.rename('B2'))//B2:0.0001	0.452-0.512 μm - Band 2 (blue) surface reflectance
      .addBands(zero.rename('B3'))//B3:0.0001	0.533-0.590 μm - Band 3 (green) surface reflectance
      .addBands(zero.rename('B4'))//B4:Band 4 (red) surface reflectance
      .addBands(zero.rename('B5'))//B5:0.0001	0.851-0.879 μm - Band 5 (near infrared) surface reflectance
      .addBands(zero.rename('B6'))//B6:0.0001	1.566-1.651 μm - Band 6 (shortwave infrared 1) surface reflectance
      .addBands(zero.rename('B7'))//B7:0.0001	2.107-2.294 μm - Band 7 (shortwave infrared 2) surface reflectance
      .addBands(zero.rename('B10'))//B10	Kelvin:0.1	10.60-11.19 μm - Band 10 brightness temperature. This band, while originally collected with a resolution of 100m / pixel, has been resampled using cubic convolution to 30m.
      .addBands(zero.rename('B11'))//B11	Kelvin:0.0001	11.50-12.51 μm - Band 11 brightness temperature. This band, while originally collected with a resolution of 100m / pixel, has been resampled using cubic convolution to 30m.
      .addBands(zero.rename('sr_aerosol'))])  )//Aerosol attributes
    );
	
  //Calculate turbidity
  dataset = dataset.map( function(img){
      var turbidity = LST_turbidity(img).rename('Turbidity');
      var TSM = LST_TSM(img).rename('TSM');
      var Chla = LST_CHL_a(img).rename('Chla');
      //
      return  Chla
        .addBands(TSM)
        .addBands(turbidity);
    }, false);
  
  return ee.ImageCollection(dataset)
    .set('scale',exports.WATERMEAS.LST.scale);
};

/*---------------------------------------------------------------------------------------
*  Return Water quality dataset
---------------------------------------------------------------------------------------*/
exports.getWaterQual = function(sensor, DateStart, DateEnd, poly, waterMask, algorithm){
  
  var waterQual = ee.Algorithms.If( ee.String(sensor).compareTo('S3').eq(0),
      getWaterQual_S3(DateStart, DateEnd, poly, waterMask, algorithm),
      getWaterQual_LST(DateStart, DateEnd, poly, waterMask, algorithm)
    );
  
  return ee.ImageCollection(waterQual);
};
