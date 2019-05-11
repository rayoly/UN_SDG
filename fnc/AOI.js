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
/*----------------------------------------------------------------------------------------
This script's functions return information about areas of interests such as name, shape
The information is based on GAUL 2008 for the countries' administrative regions
and USDOS LSIB_SIMPLE 2017 for the countries
-----------------------------------------------------------------------------------------*/
//var CONFIG = require('users/rayoly/SDG_APP:config.js');
var countryAbbr = require('users/rayoly/SDG_APP:fnc/countryAbbr.js');

/****************************************************************************************
* Get administrative region list and polygon
*****************************************************************************************/
exports.GAUL1 = ee.FeatureCollection('users/rayoly/GAUL_2008_1');
//Use dataset USDOS LSIB 2017
exports.COUNTRY_DATASET = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017');
//
//exports.country_name_key =  'COUNTRY_NA';
exports.country_name_key = 'country_na';
exports.CountryNames = ee.List(exports.COUNTRY_DATASET.aggregate_array(exports.country_name_key)).distinct().getInfo();

// Some pre-set locations of interest that will be loaded into a pulldown menu.
exports.CountryLoc = {
  'Namibia': {lon: 18, lat: -22, zoom: 5, polygon: {}},
  'Botswana': {lon: 24, lat: -22, zoom: 5, polygon: {}}
};

for(var nkey in exports.CountryNames){
  exports.CountryLoc[exports.CountryNames[nkey]] = {lon: 0, lat:0, zoom:5, polygon:{}};
}
//
for (var key in exports.CountryLoc) {
  //Select a specific country
  exports.CountryLoc[key].polygon = exports.COUNTRY_DATASET
      .filterMetadata(exports.country_name_key,'equals',key)
      .first().geometry();

  if(exports.CountryLoc[key].lon===0 && exports.CountryLoc[key].lat===0){
    var cent = ee.Geometry(exports.CountryLoc[key].polygon).centroid();
    exports.CountryLoc[key].lon = cent.coordinates().get(0);
    exports.CountryLoc[key].lat = cent.coordinates().get(1);
  }
}

exports.RegionsList = function(country)
{
  var ADM1Lst = exports.GAUL1.filter(ee.Filter.eq('ADM0_NAME',country));
  var RegionLst = ee.List(ADM1Lst.aggregate_array('ADM1_NAME')).distinct().getInfo();
  RegionLst = ['All'].concat(RegionLst);
  return RegionLst;
}


exports.RegionPolygon = function(country, region)
{
  var SelRegionPolygon = exports.GAUL1
    .filter(ee.Filter.eq('ADM0_NAME',country))
    .filter(ee.Filter.eq('ADM1_NAME',region))
    .first().geometry();

  return SelRegionPolygon;
}

/****************************************************************************************
* Get clipping polygon from USGS dataset or shapefile
*****************************************************************************************/
exports.GetClippingPolygon = function (country, region, assetname, regionid) {
  var poly;
  
  if(assetname.length>0 && regionid>=0){
    var Countrydataset = ee.Collection.loadTable(assetname);

    //merge all features
    if(regionid>0){
      Countrydataset = ee.Feature(Countrydataset.toList(1,regionid-1).get(0));
    }else{
      Countrydataset = Countrydataset.union().first();
    }
    poly = Countrydataset.geometry().getInfo();
    
  }else{
    if(region=='All'){
      poly = exports.CountryLoc[country].polygon;
    }else{
      poly = exports.RegionPolygon(country, region);
    }
  }
  //remove incorrect geometries (e.g. linestring with 2 vertices...)
  var geo_list = ee.Geometry(poly).geometries();
  //
  geo_list = ee.List(geo_list.iterate(function(cur, prev){
    return ee.Algorithms.If(
      ee.Geometry(cur).coordinates().flatten().length().gt(4),
      ee.List(prev).add(ee.Geometry(cur)),
      prev);
    },
    ee.List([])));
    
  var union_poly = geo_list.slice(1).iterate(function(cur, prev){
    return ee.Algorithms.If(
      ee.Geometry(cur).coordinates().flatten().length().gt(4),
      ee.Geometry(prev).union(ee.Geometry(cur)),
      prev);
    },
  geo_list.get(0));
  
  var coords = ee.Geometry(union_poly).coordinates();
  var linearRing = ee.Geometry.LinearRing(coords.flatten());
  return {polygon:union_poly, outline:linearRing};
};
/****************************************************************************************
* AOI's area
*****************************************************************************************/
exports.AOIarea = function(Polygon, AreaScale){
  return ee.Image.pixelArea().clip(Polygon).rename('area').reduceRegion({
      reducer: ee.Reducer.sum(), 
      geometry: Polygon, 
      scale: AreaScale,
      //bestEffort: true,
      maxPixels: 1e11
    }).get('area');
};
/****************************************************************************************
* Return country code from the country name
*****************************************************************************************/
exports.countryCode = function(country){
  var key = Object.keys(countryAbbr.Abbr).filter(function(key) {return countryAbbr.Abbr[key] === country})[0];
  return key;
}