//
exports.AIRMEAS = { 
              CO: {data:ee.ImageCollection("COPERNICUS/S5P/NRTI/L3_CO"), scale: 7000, 
                visParam: {
                  min:0,
                  max:0.00005,
                  palette: ["black", "blue", "purple", "cyan", "green", "yellow", "red"]}
              }, //500x500, 36arcsec, 0.01 arcdeg
            NO2: {data:ee.ImageCollection("COPERNICUS/S5P/OFFL/L3_NO2"), rural_mask:[], scale: 250, 
                visParam: {
                  min:0,
                  max:0.00005,
                  palette: ["black", "blue", "purple", "cyan", "green", "yellow", "red"]}
              }, //500x500, 36arcsec, 0.01 arcdeg
            SO2: {data:ee.ImageCollection("COPERNICUS/S5P/OFFL/L3_SO2"), scale: 7000, 
                visParam: {
                  min:0,
                  max:0.00005,
                  palette: ["black", "blue", "purple", "cyan", "green", "yellow", "red"]}
              }, //500x500, 36arcsec, 0.01 arcdeg
            AEROS: {data:ee.ImageCollection("COPERNICUS/S5P/OFFL/L3_AER_AI"), scale: 7000, 
                visParam: {
                  min:0,
                  max:0.00005,
                  palette: ["black", "blue", "purple", "cyan", "green", "yellow", "red"]}
              }, //500x500, 36arcsec, 0.01 arcdeg
            HCHO: {data:ee.ImageCollection("COPERNICUS/S5P/NRTI/L3_HCHO"), scale: 7000, 
                visParam: {
                  min:0,
                  max:0.00005,
                  palette: ["black", "blue", "purple", "cyan", "green", "yellow", "red"]}
              }, //500x500, 36arcsec, 0.01 arcdeg
            };

var empty_mask = ee.ImageCollection([ee.Image([])])
              .set('system:time_start',ee.Date.fromYMD(1990, 3, 1 ).millis())
              .set('system:time_end',ee.Date.fromYMD(2030, 12, 31 ).millis());
 
 
//------------------------------------------------------------------------------

/*------------------------------------------------------------------------------
*
------------------------------------------------------------------------------*/
exports.getAirQual = function(DateStart, DateEnd, poly, year, CountryAbbr, useGlobalDataset, geeAsset){
  
  var zeroImg = ee.Image.constant(0);

  //-- CO 
  var AirCO = exports.AIRMEAS.CO.data
    .filterBounds(poly)
    .filter(ee.Filter.date( DateStart, DateEnd )) ;
  AirCO = ee.Image(ee.Algorithms.If( AirCO.size(),
      AirCO.mean().select('CO_column_number_density').set('scale', exports.AIRMEAS.CO.scale), 
      zeroImg.set('scale',10000) ))
    .clip(poly)
    .set('database','CO','name','CO')
    .rename('CO');//band name must match <database>       

  //-- SO2 
  var AirSO2 = exports.AIRMEAS.SO2.data
    .filterBounds(poly)
    .filter(ee.Filter.date( DateStart, DateEnd )) ;
  AirSO2 = ee.Image(ee.Algorithms.If( AirSO2.size(),
      AirSO2.mean().select('SO2_column_number_density').set('scale', exports.AIRMEAS.SO2.scale), 
      zeroImg.set('scale',10000) ))
    .clip(poly)
    .set('database','SO2','name','SO2')
    .rename('SO2');//band name must match <database>       

  //-- NO2 
  var AirNO2 = exports.AIRMEAS.NO2.data
    .filterBounds(poly)
    .filter(ee.Filter.date( DateStart, DateEnd )) ;
  AirNO2 = ee.Image(ee.Algorithms.If( AirNO2.size(),
      AirNO2.mean().select('NO2_column_number_density').set('scale', exports.AIRMEAS.NO2.scale), 
      zeroImg.set('scale',10000) ))
    .clip(poly)
    .set('database','NO2','name','NO2')
    .rename('NO2');//band name must match <database>       

  //-- HCHO 
  var AirHCHO = exports.AIRMEAS.HCHO.data
    .filterBounds(poly)
    .filter(ee.Filter.date( DateStart, DateEnd )) ;
  AirHCHO = ee.Image(ee.Algorithms.If( AirHCHO.size(),
      AirHCHO.map(function(img){ return img.select('HCHO_slant_column_number_density')})
      .mean()
      .set('scale', exports.AIRMEAS.HCHO.scale), 
      zeroImg.set('scale',10000) ))
    .clip(poly)
    .set('database','HCHO','name','HCHO')
    .rename('HCHO');//band name must match <database>       

  //-- Aerosol 
  var AirAerosol = exports.AIRMEAS.AEROS.data
    .filterBounds(poly)
    .filter(ee.Filter.date( DateStart, DateEnd )) ;
  AirAerosol = ee.Image(ee.Algorithms.If( AirAerosol.size(),
      AirAerosol.mean().select('absorbing_aerosol_index').set('scale', exports.AIRMEAS.AEROS.scale), 
      zeroImg.set('scale',10000) ))
    .clip(poly)
    .set('database','Aerosol','name','Aerosol')
    .rename('Aerosol');//band name must match <database>    
    
  /*--------------------------------------------------------
  * Image collection of all population dataset
  *   update the mask
  ---------------------------------------------------------*/
  /*var AirQualMap = ee.ImageCollection.fromImages( ee.Algorithms.If(useGlobalDataset,
    [AirCO, AirSO2, AirNO2, AirHCHO, AirAerosol],
    [geeAsset]));*/
  var AirQualMap = ee.ImageCollection.fromImages( [AirCO, AirSO2, AirNO2, AirHCHO, AirAerosol]);
  return AirQualMap;
}

