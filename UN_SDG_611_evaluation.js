//Raymond Olympio, 2019
/*******************************************************************
Configuration
*******************************************************************/

var USE_RECT_PATCHES = false; //Set to false to use actual country region, true for patch extraction
var GoogleDriveDir = 'UN_SDG_6.1.1'; //Folder in Google Drive
var EXPORT_TO_DRIVE = false;//set to true to export to Google Drive
var EXPORT_TO_ASSET = false;//set to true to export to GEE Assets
var AreaScale = 30; //A nominal scale in meters of the projection to work in.
var ShapeFileAsset = 'users/rayoly/ADMIN_Regional_Boundaries_2014'
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
var YearStart = 2011;
var YearEnd = 2015;
var DateStart = '2015-01-01';
var DateEnd = '2015-12-31';
var avg_area = 0;
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
  var water03 = image.gte(3.0);
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
  var Countrydataset
  //Use dataset USDOS LSIB 2017
  Countrydataset = ee.FeatureCollection('USDOS/LSIB/2017');
  //Select a specific country
  Countrydataset = Countrydataset.filterMetadata('COUNTRY_CO','equals',CountryCode)
  //retrieve country border as polygon
  Polygon = Countrydataset.first().geometry();
  Map.addLayer(Polygon,{color:'ffbb75', opacity: 0.5},'Selected Region - USDOS')
    
  if(ShapeFileAsset){//Use the shape file asset
    var USDOS_Polygon = Polygon
    Countrydataset = ee.Collection.loadTable(ShapeFileAsset);
    //merge all features
    Countrydataset = Countrydataset.union();
    //
    Polygon = Countrydataset.first().geometry();
    Map.addLayer(Polygon,{color:'75f8ff', opacity: 0.5}, 'Selected Region - Shapefile')
    
    var diffPolygon = Polygon.difference(USDOS_Polygon);
    Map.addLayer(diffPolygon,{color:'ff0000'},'Selected Region - Difference')
  }

  //Calculate properties of the area
  var area = Polygon.area().divide(1000 * 1000);
  var perimeter = Polygon.perimeter().divide(1000);
  var centroid = Polygon.centroid();
  var bounds = Polygon.bounds();
  
  print('Area:',area, 'km2');
  print('Perimeter:',perimeter, 'km');
  print('Centroid:',centroid, 'm');
  print('Bounds:',bounds, 'm');

  
}
//Calculate center of the area
CenterX = 0.5*(Xmin+Xmax)
CenterY = 0.5*(Ymin+Ymax)

//--------------------------------------------------------
for(var Year=YearStart;Year<=YearEnd;Year+=1){
  DateStart = Year + '-01-01';
  DateEnd = Year + '-12-31';

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
    Map.addLayer(ImgRegion,{palette:'0000ff'},'Clipped Water for ' + CountryCode + ' in ' + Year);
    //Calculate the water area
    var area = waterCount(ImgWaterRegion, Polygon);
    //Export data
    ExportData(ImgWaterRegion, CountryCode, Polygon);
    //print 
    avg_area = avg_area + area/1e6;
    print('Year ' + Year + ', Water Area = ' + (area/1e6) + 'km^2');
  }
}

print('Average Area from ' +YearStart + ' to ' + YearEnd + ' is ' + avg_area/(YearEnd-YearStart+1) + 'km^2');
