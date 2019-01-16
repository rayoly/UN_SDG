/*******************************************************************
* Raymond Olympio, 2019
* Example of the calculation of UN SDG 6.1.1 for Namibia
*******************************************************************/

/*******************************************************************
Configuration
*******************************************************************/

var USE_RECT_PATCHES = false; //Set to false to use actual country region, true for patch extraction
var GoogleDriveDir = 'UN_SDG_6.1.1'; //Folder in Google Drive
var EXPORT_TO_DRIVE = false;//set to true to export to Google Drive
var EXPORT_TO_ASSET = false;//set to true to export to GEE Assets
var AreaScale = 30; //A nominal scale in meters of the projection to work in.
//Corner definition of the region of interest (here: Namibia)
var Xmin = 10;
var Xmax = 26;
var Ymax = -16;
var Ymin = -29;
var DeltaX = Xmax-Xmin;//1
var DeltaY = Ymax-Ymin;//1
//Zoom level: 0=156km, 5=4.9km at equator
var ZoomLvl = 5;
//Country code for region of interest, here: Namibia->”WA”
var CountryCode = 'WA';
var DateStart = '2015-01-01';
var DateEnd = '2015-12-31';

/*******************************************************************
Local variables
*******************************************************************/
var CenterX, CenterY;
var x,y;
var SelRegion;
var ImgRegion;
var Polygon;
/*******************************************************************
Local functions
*******************************************************************/
// Process data: count the area of pixel with value >= 3.0
var waterCount = function(image, geometry){
  //var water03 = image.gte(3.0);
  var water03 = image.gte(2.90);
  var area = ee.Image.pixelArea();
  var waterArea = water03.multiply(area).rename('waterArea');

  var stats = waterArea.reduceRegion({
      reducer: ee.Reducer.sum(), 
      geometry: geometry, 
      scale: AreaScale,
      maxPixels: 1e10
    });
  //print(stats);
  var StrArea = stats.get('waterArea');
  return StrArea.getInfo();
};
//Export data
var ExportData = function(ImgWaterRegion, CountryCode, SelRegion){
  if (EXPORT_TO_DRIVE){
      Export.image.toDrive({
      image: ImgWaterRegion,
      folder: GoogleDriveDir,
      description: 'Region_'+CountryCode,
      scale: AreaScale,
      region: SelRegion,
      maxPixels: 1e10,
      skipEmptyTiles: true,
      crs: 'EPSG:3857',
      fileFormat: 'GeoTIFF'
      });
  }
  if (EXPORT_TO_ASSET){
    Export.image.toAsset({
      image: ImgWaterRegion,
      description: 'Region_'+CountryCode,
      scale: AreaScale,
      region: SelRegion,
      maxPixels: 1e10,
      crs: 'EPSG:3857'
      });
  }
}

//------------------------------------------------- Retrieve Country Border
if (!USE_RECT_PATCHES) {
  var Countrydataset = ee.FeatureCollection('USDOS/LSIB/2013');
  //Select a specific country
  Countrydataset = Countrydataset.filterMetadata('cc','equals',CountryCode)
  
  //Calculate properties of the area
  Polygon = Countrydataset.first().geometry();
  var area = Polygon.area().divide(1000 * 1000);
  var perimeter = Polygon.perimeter().divide(1000);
  var centroid = Polygon.centroid();
  var bounds = Polygon.bounds();
  
  print('Area:',area, 'km2');
  print('Perimeter:',perimeter, 'km');
  print('Centroid:',centroid, 'm');
  print('Bounds:',bounds, 'm');

  //DisplayvisParams
  var visParams = {
    palette: ['ff00ff','ff00ff'],
    opacity: 0.5
  };
  Map.addLayer(Polygon,visParams,'CountryBorder and Selected Region')
}
//Calculate center of the area
CenterX = 0.5*(Xmin+Xmax)
CenterY = 0.5*(Ymin+Ymax)

//--------------------------------------------------------
var dataset = ee.ImageCollection('JRC/GSW1_0/YearlyHistory')
                  .filter(ee.Filter.date(DateStart, DateEnd));
var waterClass = dataset.select('waterClass');
var waterClassVis = {
  min: 0.0,
  max: 3.0,
  palette: ['cccccc', 'ffffff', '99d9ea', '0000ff'],
};
Map.setCenter(CenterX, CenterY, ZoomLvl);
//Map.addLayer(waterClass, waterClassVis, 'Water Class');

var FullRectRegion = ee.Geometry.Rectangle([Xmin, Ymin, Xmax, Ymax]);
//Map.addLayer(FullRectRegion, {palette: ['CCCCCC']}, 'RectRegion');

//get 
var ImgWaterRegion = ee.Image(dataset.first());
      
//we can either extract patches or use directly the country borders!
if (USE_RECT_PATCHES) {
  for (x = Xmin; x < Xmax; x+=DeltaX) {
    for (y = Ymin; y < Ymax; y+=DeltaY) {
      print('Region: x=' + x + ', y=' + y + ', step = [' + DeltaX + ',' + DeltaY + ']')
      SelRegion = ee.Geometry.Rectangle([x, y, x+DeltaX, y+DeltaY]);
      
      //clip everything outside the SelRegion
      ImgRegion = ImgWaterRegion.clip(SelRegion);
      
      //Calculate the water area
      var area = waterCount(ImgWaterRegion, SelRegion);
      ExportData(ImgWaterRegion, CountryCode, SelRegion);
      print('Water Area = ',area,'km^2');
    }
  }
}else{
  //clip everything outside the Polygon
  ImgRegion = ImgWaterRegion.clip(Polygon);  
  Map.addLayer(ImgRegion,{palette:'0000ff'},'Clipped Water');
  //Calculate the water area
  var area = waterCount(ImgWaterRegion, Polygon);
  //Export data
  ExportData(ImgWaterRegion, CountryCode, Polygon);
  //print result
  print('Water Area = ',area/1e6,'km^2');
}
