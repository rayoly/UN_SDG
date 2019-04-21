/****************************************************************************************
* Get administrative region list and polygon
*****************************************************************************************/
exports.GAUL1 = ee.FeatureCollection('users/rayoly/g2008_1');

exports.RegionsList = function(country)
{
  var ADM1Lst = exports.GAUL1.filter(ee.Filter.eq('ADM0_NAME',country));
  var RegionLst = ee.List(ADM1Lst.aggregate_array('ADM1_NAME')).distinct().getInfo();
  var RegionPolygon = [];
  for (var key in RegionLst) {
    //Select a specific country
    RegionPolygon[key] = ADM1Lst
      .filterMetadata('ADM1_NAME','equals',key)
      .first().geometry();
  }
  RegionLst = ['All'].concat(RegionLst);
  return RegionLst;
}


exports.RegionPolygon = function(country, region)
{
  var RegionPolygon = exports.GAUL1
    .filter(ee.Filter.eq('ADM0_NAME',country))
    .filter(ee.Filter.eq('ADM1_NAME',region))
    .first().geometry();

  return RegionPolygon;
}
