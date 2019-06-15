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
This script generate a GUI for the selection of an AOI
Requires: AOI, helpBox
-----------------------------------------------------------------------------------------*/
var countryAbbr = require('users/rayoly/SDG_APP:fnc/countryAbbr.js');

exports.Location = {};
exports.RegionLst = [];
exports.ROAD_DATASET = {data:[], scale:100, coef:1};

exports.countryName = '';
exports.regionName = '';

exports.AssetName = '';
exports.RegionID = -1;

var gui = {};
gui.POINT_LST = [];
var useRoad = false;
var road_data;

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
  //
  if(exports.selectedGEEAsset() && assetname.length>0 && regionid>=0){//return defined GEE Asset
    var Countrydataset = ee.Collection.loadTable(assetname);

    //merge all features
    if(regionid>0){
      Countrydataset = ee.Feature(Countrydataset.toList(1,regionid-1).get(0));
    }else{
      Countrydataset = Countrydataset.union().first();
    }
    poly = Countrydataset.geometry().getInfo();
    
  }else if(exports.selectedPreShape()){ //return shape for selected country and region
    if(region=='All'){
      poly = exports.CountryLoc[country].polygon;
    }else{
      poly = exports.RegionPolygon(country, region);
    }
  }else if(exports.selectedPolygon() && gui.POINT_LST.length>=3){ //return currently drawn polygon
    poly = ee.Geometry.Polygon(gui.POINT_LST);
  }else{ //return empty polygon
    print('No defined Geometry!!');
    print(gui.POINT_LST)
    poly = ee.Geometry.Polygon([[0,0],[1,0],[1,1],[0,1],[0,0]]);
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
};
/****************************************************************************************
*  
*****************************************************************************************/
var retrieve_road_network = function(country, region, assetname, regionid){
  var poly = exports.GetClippingPolygon(country, region, assetname, regionid).polygon;
  var road_asset = 'users/rayoly/' + country.toUpperCase() +'_ROADS';
  print('Loading road asset:' + road_asset + ' for ' + country + '/' + region + ' or ' + assetname + '/' + regionid); 
  var prop = {
    properties: ['code'],
    reducer: ee.Reducer.first()
  };
  exports.ROAD_DATASET.data = ee.Collection.loadTable(road_asset);
  var propnames = exports.ROAD_DATASET.data.first().propertyNames();

  propnames.evaluate( function(success, fail){
    if(typeof fail !== 'undefined'){
      gui.HELP.show_help_panel('The road dataset for the selected region was not found');
      exports.ROAD_DATASET.data = ee.FeatureCollection([ee.Geometry.LineString([0,0,0.1,0.1])]).set('code',1);
	  propnames = exports.ROAD_DATASET.data.first().propertyNames();
    }
    //
    exports.ROAD_DATASET.data = ee.Image(exports.ROAD_DATASET.data
      .filter(ee.Filter.bounds(poly))
      .filter(ee.Filter.notNull(propnames))
      .reduceToImage(prop));
  });  
};
/****************************************************************************************
* Define panel for selecting the AOI
*****************************************************************************************/
var clearPolygon = function(){
  gui.mapPanel.style().set('cursor', 'hand');
  gui.mapPanel.unlisten();
  gui.POINT_LST = [];
  if (typeof gui.PolygonLayer !== 'undefined'){
    gui.mapPanel.remove(gui.PolygonLayer);  
  }
};
var createPolygon = function(coords){
  gui.mapPanel.style().set('cursor', 'crosshair');
  gui.POINT_LST.push([coords.lon, coords.lat]); 
  if (typeof gui.PolygonLayer !== 'undefined'){
    gui.mapPanel.remove(gui.PolygonLayer);  
  }
  if(gui.POINT_LST.length>=3){
    gui.PolygonLayer = ui.Map.Layer(ee.Geometry.Polygon(gui.POINT_LST), {color: '000000'}, 'drawn polygon');
    gui.mapPanel.add(gui.PolygonLayer);
  }
};
/****************************************************************************************
* Define panel for selecting the AOI
*****************************************************************************************/
exports.createGUI = function(mapPanel, HELP,  GUIPREF, country, region, useRoad){
  gui.mapPanel = mapPanel;
  //default values
  exports.Location = exports.CountryLoc[country];
  exports.RegionLst = exports.RegionsList(country); 

  exports.regionName = region;
  exports.countryName = country;
  gui.HELP = HELP;
  if(typeof useRoad == 'undefined'){
    useRoad = false;
  }
  //
  /****************************************************************************************
  * GUI: pull down menus for the selection of a predefine shape (country and region)
  *****************************************************************************************/
  //------------------------------------------------------------ Create the country pulldown
  var locations = Object.keys(exports.CountryLoc);
    
  var index = locations.sort().indexOf(country);
  gui.countrySelect = ui.Select({
    items: locations.sort(),
    value: locations[index],
    style: GUIPREF.SELECT_STYLE,
    //------------------------------------
    onChange: function(country) {
      exports.Location = exports.CountryLoc[country];
      exports.countryName = country;
      exports.regionName = 'All';
      //
      if(useRoad){
        retrieve_road_network(exports.countryName , exports.regionName, exports.AssetName, exports.RegionID);
      }
      //
      gui.active_preshape.setValue(true);
      gui.active_gee_asset.setValue(false);
      gui.current_Polygon.setValue(false);
      //Get administrative regions
      if(typeof AOI !== 'undefined'){
        exports.RegionLst = AOI.RegionsList(country);
      }else{
        exports.RegionLst = exports.RegionList(country);
      }
      gui.regionSelect = ui.Select({
        items: exports.RegionLst,
        value: exports.RegionLst[0],
        style: GUIPREF.SELECT_STYLE,
        onChange: function(value) {
          exports.regionName = value;
          //
          if(useRoad){
            retrieve_road_network(AOI, exports.countryName , exports.regionName, exports.AssetName, exports.RegionID);
          }
          gui.active_preshape.setValue(true);
          gui.active_gee_asset.setValue(false);
          gui.current_Polygon.setValue(false);
        }
      });
      gui.predefLocPanel.widgets().set(2,gui.regionSelect);
      //Update center of map
      gui.mapPanel.centerObject(ee.Geometry(exports.Location.polygon));
    }
  });
  
  //------------------------------------------------------------ Create the region pulldown
  var regions = exports.RegionLst.sort();
  gui.regionSelect = ui.Select({
    items: regions,
    value: regions[regions.indexOf(region)],
    style: GUIPREF.SELECT_STYLE,
    onChange: function(value) {
      exports.regionName = value;
      //
      if(useRoad){
        retrieve_road_network(AOI, exports.countryName , exports.regionName, exports.AssetName, exports.RegionID);
      }
      //
      gui.active_preshape.setValue(true);
      gui.active_gee_asset.setValue(false);
      gui.current_Polygon.setValue(false);
      //Update center of map
      gui.mapPanel.centerObject(ee.Geometry(exports.Location.polygon));    
    }
  });

  //-------------------------------------------------------------------------------------  Selection of a predefined shape 
  gui.helppreshape = HELP.helpButton('Select the Region Of Interest, based on USDOS LSIB. Regional levels are defined from GAUL level 1, 2008.');
  gui.active_preshape = ui.Checkbox( {label:'Predefined:', value: true, style: GUIPREF.CKBOX_STYLE} );
  //gui.active_preshape.setDisabled(true);
  
   //------------------------------------------------------------------------------------- Build Help for GEE Asset
  gui.helpgeeasset = HELP.helpButton('Select a region from your GEE ASSETS with the defined layer ID.');
  gui.active_gee_asset = ui.Checkbox( {label:'GEE ASSET Shapefile:', value: false, style: GUIPREF.CKBOX_STYLE} );
  //gui.active_gee_asset.setDisabled(true);
  
  //------------------------------------------------------------------------------------- Build Help for GEE Asset
  gui.helppolygon = HELP.helpButton('Select a region from your GEE ASSETS with the defined layer ID.');
  gui.current_Polygon = ui.Checkbox( {label:'Drawn Polygon', value: false, style: GUIPREF.CKBOX_STYLE} );
  //gui.current_Polygon.setDisabled(true);
  
 /****************************************************************************************
  * GUI: Text box for the use of an asset file
  *****************************************************************************************/
  
  //------------------------------------------------------------------------------------- Build GEE Asset name box
  GUIPREF.EDIT_STYLE.width = '200px';
  gui.asset_textbox = ui.Textbox({
    placeholder: 'users/<username>/....',
    style: GUIPREF.EDIT_STYLE,
    onChange: function(text) {
      exports.AssetName = text;
      if(exports.AssetName.length>0 && exports.RegionID>=0){
          //var poly = AOI.GetClippingPolygon(exports.countryName, exports.regionName, exports.AssetName, exports.RegionID);
          //mapPanel.add(ui.Map.Layer(poly.outline, {}, 'Region'));		
          HELP.show_help_panel('New asset to use ' + exports.AssetName );
          //
          gui.active_preshape.setValue(false);
          gui.active_gee_asset.setValue(true);
          gui.current_Polygon.setValue(false);
        }else{
          gui.active_preshape.setValue(true);
          gui.active_gee_asset.setValue(false);
          gui.current_Polygon.setValue(false);
        }
      }
  });
  //------------------------------------------------------------------------------------- Build Layer ID box
  GUIPREF.EDIT_STYLE.width = '50px';
  gui.asset_LID_textbox = ui.Textbox({
    placeholder: 'Layer ID',
    style: GUIPREF.EDIT_STYLE,
    onChange: function(text) {
      if((typeof text=='string' && text.length>0) || text>=0){
        exports.RegionID = Number(text);
      }else{
        exports.RegionID = -1;
      }
      if(exports.AssetName.length>0 && exports.RegionID>=0){
        //var poly = AOI.GetClippingPolygon(exports.countryName, exports.regionName, exports.AssetName, exports.RegionID);
        //mapPanel.add(ui.Map.Layer(poly.outline, {}, 'Region'));	
        //
        gui.active_preshape.setValue(false);
        gui.active_gee_asset.setValue(true);
        gui.current_Polygon.setValue(false);
      }else{
        gui.active_preshape.setValue(true);
        gui.active_gee_asset.setValue(false);
        gui.current_Polygon.setValue(false);
      }
    }
  });
  //
  gui.current_Polygon.onChange(function(value){
    if(value){
      gui.active_preshape.setValue(false);
      gui.active_gee_asset.setValue(false);
      gui.current_Polygon.setValue(true);
      gui.mapPanel.onClick(createPolygon);
    }
  });    
  gui.active_preshape.onChange(function(value){
    if(value){
      gui.active_preshape.setValue(true);
      gui.active_gee_asset.setValue(false);
      gui.current_Polygon.setValue(false);
      clearPolygon();
    }
  });
  gui.active_gee_asset.onChange(function(value){
    if(value){
      gui.active_preshape.setValue(false);
      gui.active_gee_asset.setValue(true);
      gui.current_Polygon.setValue(false);
      clearPolygon();
    }
  });

  //------------------------------------------------------------------------------------- Build Panel
  gui.predefLocPanel = ui.Panel( [gui.active_preshape, gui.countrySelect, gui.regionSelect, gui.helppreshape],
    ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE);
  
  gui.assetPanel = ui.Panel([
      gui.active_gee_asset, 
      ui.Panel([gui.asset_textbox, gui.asset_LID_textbox, gui.helpgeeasset],
      ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE)
    ],
    'flow', GUIPREF.CNTRL_PANEL_STYLE);
    
  gui.polygonPanel = ui.Panel([
      ui.Panel([gui.current_Polygon,gui.helppolygon],
      ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE)
    ],
    'flow', GUIPREF.CNTRL_PANEL_STYLE);
  
  exports.LocationPanel = ui.Panel([ui.Label( 'Location:', GUIPREF.LABEL_T_STYLE),  
    gui.predefLocPanel, 
    gui.assetPanel,
    gui.polygonPanel], 'flow', GUIPREF.CNTRL_PANEL_STYLE);
    
  //
  if(useRoad){
    retrieve_road_network(gui.mapPanel, exports.countryName ,exports.regionName, exports.AssetName, exports.RegionID);
  }
};
/****************************************************************************************
* Retrieve the status of the GEE Asset checkbox
*****************************************************************************************/
exports.selectedGEEAsset = function(){
  return gui.active_gee_asset.getValue();
};
exports.selectedPreShape = function(){
  return gui.active_preshape.getValue();
};
exports.selectedPolygon = function(){
  return gui.current_Polygon.getValue();
};
/****************************************************************************************
* Set the status of the GEE Asset checkbox
*****************************************************************************************/
exports.setAsset = function(assetName, layerID){
  gui.asset_textbox.setValue(assetName);
  gui.asset_LID_textbox.setValue(layerID);
  exports.AssetName = assetName;
  exports.RegionID = layerID;
};