//Raymond Olympio, 2019
/*******************************************************************
Configuration
*******************************************************************/

//Indicate whether or not to export the maps to Google Drive
var EXPORT_TO_DRIVE = true;//set to true to export to Google Drive
//Google Drive directory
var GoogleDriveDir = 'UN_SDG_6.6.1'; //Folder in Google Drive

//Indicate whether or not to export the maps to Assets
var EXPORT_TO_ASSET = false;//set to true to export to GEE Assets

//Area Scale, A nominal scale in meters of the projection to work in.
var AreaScale = 30; 

//name of a file in the "Assets"
var ShapeFileAsset = 'users/rayoly/NAMIBIA_Regional_Boundaries_2014'
var RegionID = 1;

//Corner definition of the region of interest (here: Namibia)
var Xmin = 10;
var Xmax = 26;
var Ymax = -16;
var Ymin = -29;

//Zoom level: 0=156km, 5=4.9km at equator
var ZoomLvl = 5;

//Country code for region of interest, here: Namibia->”WA”
var CountryCode = 'WA';

//Start and End Years
var YearStart = 1984;
var YearEnd = 2015;

//Type of water
var WATER_TYPE=3.0; //Permanent:3, Seasonal:2

//CRS
var EXPORT_CRS = 'EPSG:4326';
/*********************************************************************
 * Local Variables
 *********************************************************************/
var DeltaX = Xmax-Xmin;//1
var DeltaY = Ymax-Ymin;//1
//Calculate center of the area
CenterX = 0.5*(Xmin+Xmax)
CenterY = 0.5*(Ymin+Ymax)
var DateStart, DateEnd;
var avg_area = 0;
var SHOW_WATER_LAYER = true;
var Countrydataset;
var result_name;

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
  var water03 = image.eq(WATER_TYPE);
  var area = ee.Image.pixelArea();
  var waterArea = water03.multiply(area).rename('waterArea');

  var stats = waterArea.reduceRegion({
      reducer: ee.Reducer.sum(), 
      geometry: geometry, 
      scale: AreaScale,
      maxPixels: 1e10
    });
  var StrArea = stats.get('waterArea');
  return StrArea.getInfo();
};
//Export data
var ExportData = function(ImgWaterRegion, Description, SelRegion){
  if (EXPORT_TO_DRIVE){
      Export.image.toDrive({
      image: ImgWaterRegion,
      folder: GoogleDriveDir,
      description: Description,
      scale: AreaScale,
      region: SelRegion,
      maxPixels: 1e10,
      skipEmptyTiles: true,
      crs: EXPORT_CRS,
      fileFormat: 'GeoTIFF'
      });
  }
  if (EXPORT_TO_ASSET){
    Export.image.toAsset({
      image: ImgWaterRegion,
      description: 'Asset_'+Description,
      scale: AreaScale,
      region: SelRegion,
      maxPixels: 1e10,
      crs:EXPORT_CRS
      });
  }
}


/*********************************************************************
 * Main routine
 *********************************************************************/
//------------------------------------------------- Retrieve Country Border
//Use dataset USDOS LSIB 2017
Countrydataset = ee.FeatureCollection('USDOS/LSIB/2017');
//Select a specific country
Countrydataset = Countrydataset.filterMetadata('COUNTRY_CO','equals',CountryCode)
//retrieve country border as polygon
Polygon = Countrydataset.first().geometry();
Map.addLayer(Polygon,{color:'ffbb75', opacity: 0.5},'Selected Region - USDOS')
  
if(ShapeFileAsset){//Use the shape file asset
  var USDOS_Polygon = Polygon; //save USDOS Polygon
  Countrydataset = ee.Collection.loadTable(ShapeFileAsset);
  //merge all features
  if(RegionID>0){
    Countrydataset = ee.Feature(Countrydataset.toList(1,RegionID-1).get(0));
    print(Countrydataset);
    Polygon = Countrydataset.geometry();
  }else{
    Countrydataset = Countrydataset.union().first();
    Polygon = Countrydataset.geometry();
  }
  //
  Map.addLayer(Polygon,{color:'75f8ff', opacity: 0.5}, 'Selected Region - Shapefile')
  var diffPolygon = Polygon.difference(USDOS_Polygon);
  Map.addLayer(diffPolygon,{color:'ff0000'},'Selected Region - Difference')
}

//Calculate properties of the area
var area = Polygon.area().divide(1000 * 1000);
var perimeter = Polygon.perimeter().divide(1000);
var centroid = Map.getCenter();//Polygon.centroid();
var bounds = Polygon.bounds().coordinates();

print('Area:',area, 'km2');
print('Perimeter:',perimeter, 'km');
print('Centroid:',centroid, 'm');
print('Bounds:',bounds.get(0));

//Get Xmin, Xmax, Ymin and Ymax from bounds
var coords = bounds.flatten();
//update_min_max(coords);

//Center Map on region of interest
Map.setCenter(CenterX, CenterY, ZoomLvl);
//Draw Rectangle around the region of interest
var FullRectRegion = ee.Geometry.Rectangle([Xmin, Ymin, Xmax, Ymax]);
//Map.addLayer(FullRectRegion, {color:'eeeeee', opacity: 0.9}, 'RectRegion');

//--------------------------------------------------------
for(var Year=YearStart;Year<=YearEnd;Year+=1){
  DateStart = Year + '-01-01';
  DateEnd = Year + '-12-31';

  var dataset = ee.ImageCollection('JRC/GSW1_0/YearlyHistory')
                    .filter(ee.Filter.date(DateStart, DateEnd));
  var waterClass = dataset.select('waterClass');
  /*Map.addLayer(waterClass, {
    min: 0.0,
    max: 3.0,
    palette: ['cccccc', 'ffffff', '99d9ea', '0000ff'],
  }, 'Water Class');*/
  
  result_name = 'Region_'+ CountryCode + '_' + Year + '-R' + RegionID;
  
  //get 
  var ImgWaterRegion = ee.Image(dataset.first());
  
  //rename band
  ImgWaterRegion = ImgWaterRegion.select(['waterClass'],
     ['water_'+ WATER_TYPE + '_'+Year]);
  
  //
  //we can either extract patches or use directly the country borders!
  //
  //clip everything outside the Polygon
  ImgRegion = ImgWaterRegion.clip(Polygon);
  if(SHOW_WATER_LAYER){ //it is resource intensive to plot all layers...
    //Add layer
    Map.addLayer(ImgRegion,{palette:'0000ff'},'Clipped Water for ' + result_name);
  }
  //Calculate the water area
  var area = waterCount(ImgWaterRegion, Polygon);
  //Export data
  ExportData(ImgWaterRegion, result_name, Polygon);
  //print
  avg_area = avg_area + area/1e6;
  print('Year ' + Year + ', Water Area = ' + (area/1e6).toFixed(4) + ' km^2');
}

