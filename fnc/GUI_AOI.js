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

exports.Location = {};
exports.RegionLst = [];
exports.ROAD_DATASET = {};

exports.countryName = '';
exports.regionName = '';

exports.AssetName = '';
exports.RegionID = -1;

var gui = {};
var useRoad = false;
/****************************************************************************************
*  
*****************************************************************************************/
var retrieve_road_network = function(mapPanel, AOI, country, region, assetname, regionid){
  var poly = AOI.GetClippingPolygon(country, region, assetname, regionid).polygon; 
  var road_asset = 'users/rayoly/' + country.toUpperCase() +'_ROADS';
  print('Loading road asset:' + road_asset);      
  exports.ROAD_DATASET = {data:ee.Collection.loadTable(road_asset), scale:100, coef:1};
  var propnames = exports.ROAD_DATASET.data.first().propertyNames();
  var prop = {
    properties: ['code'],
    reducer: ee.Reducer.first()
  };
  //mapPanel.add(ui.Map.Layer(ee.Geometry(poly), {}, 'Region'));
  exports.ROAD_DATASET.data = ee.Image(exports.ROAD_DATASET.data
    .filter(ee.Filter.bounds(poly))
    .filter(ee.Filter.notNull(propnames))
    .reduceToImage(prop));
};
/****************************************************************************************
* Define panel for selecting the AOI
*****************************************************************************************/
exports.createGUI = function(mapPanel, HELP, AOI, GUIPREF, country, region, getroad){
  //default values
  exports.Location = AOI.CountryLoc[country];
  exports.RegionLst = AOI.RegionsList(country); 
  exports.regionName = region;
  exports.countryName = country;  
  if(typeof getroad == 'undefined'){
    getroad = false;
  }
  useRoad = getroad;
  //
  if(useRoad){
    retrieve_road_network(mapPanel, AOI, exports.countryName , exports.regionName, exports.AssetName, exports.RegionID);
  }
  //
  /****************************************************************************************
  * GUI: pull down menus for the selection of a predefine shape (country and region)
  *****************************************************************************************/
  //------------------------------------------------------------ Create the country pulldown
  var locations = Object.keys(AOI.CountryLoc);
  var index = locations.sort().indexOf(country);
  gui.countrySelect = ui.Select({
    items: locations.sort(),
    value: locations[index],
    style: GUIPREF.SELECT_STYLE,
    //------------------------------------
    onChange: function(country) {
      exports.Location = AOI.CountryLoc[country];
      exports.countryName = country;
      exports.regionName = 'All';
      //
      if(useRoad){
        retrieve_road_network(mapPanel, AOI, exports.countryName , exports.regionName, exports.AssetName, exports.RegionID);
      }
      //
      gui.active_preshape.setValue(true);
      gui.active_gee_asset.setValue(false);
      //Get administrative regions
      exports.RegionLst = AOI.RegionsList(country);
      gui.regionSelect = ui.Select({
        items: exports.RegionLst,
        value: exports.RegionLst[0],
        style: GUIPREF.SELECT_STYLE,
        onChange: function(value) {
          exports.regionName = value;
          //
          if(useRoad){
            retrieve_road_network(mapPanel, AOI, exports.countryName , exports.regionName, exports.AssetName, exports.RegionID);
          }
          gui.active_preshape.setValue(true);
          gui.active_gee_asset.setValue(false);
        }
      });
      gui.predefLocPanel.widgets().set(2,gui.regionSelect);
      //Update center of map
      mapPanel.centerObject(ee.Geometry(exports.Location.polygon));
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
        retrieve_road_network(mapPanel, AOI, exports.countryName , exports.regionName, exports.AssetName, exports.RegionID);
      }
      //
      gui.active_preshape.setValue(true);
      gui.active_gee_asset.setValue(false);
      //Update center of map
      mapPanel.centerObject(ee.Geometry(exports.Location.polygon));    
    }
  });

  //-------------------------------------------------------------------------------------  Selection of a predefined shape 
  gui.helppreshape = HELP.helpButton('Select the Region Of Interest, based on USDOS LSIB. Regional levels are defined from GAUL level 1, 2008.');
  gui.active_preshape = ui.Checkbox( {label:'Predefined:', value: true, style: GUIPREF.CKBOX_STYLE} );
  gui.active_preshape.setDisabled(true);
  
  gui.predefLocPanel = ui.Panel( [gui.active_preshape, gui.countrySelect, gui.regionSelect, gui.helppreshape],
    ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE);
  
  /****************************************************************************************
  * GUI: Text box for the use of an asset file
  *****************************************************************************************/
  
  //------------------------------------------------------------------------------------- Build Help for GEE Asset
  gui.helpgeeasset = HELP.helpButton('Select a region from your GEE ASSETS with the defined layer ID.');
  gui.active_gee_asset = ui.Checkbox( {label:'GEE ASSET Shapefile:', value: false, style: GUIPREF.CKBOX_STYLE} );
  gui.active_gee_asset.setDisabled(true);
  
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
        }else{
          gui.active_preshape.setValue(true);
          gui.active_gee_asset.setValue(false);
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
      }else{
        gui.active_preshape.setValue(true);
        gui.active_gee_asset.setValue(false);
      }
    }
  });
  
  //------------------------------------------------------------------------------------- Build Panel
  gui.assetPanel = ui.Panel([
      gui.active_gee_asset, 
      ui.Panel([gui.asset_textbox, gui.asset_LID_textbox, gui.helpgeeasset],
      ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE)
    ],
    'flow', GUIPREF.CNTRL_PANEL_STYLE);
  
  exports.LocationPanel = ui.Panel([ui.Label( 'Location:', GUIPREF.LABEL_T_STYLE),  gui.predefLocPanel, gui.assetPanel], 'flow', GUIPREF.CNTRL_PANEL_STYLE);
}
/****************************************************************************************
* Retrieve the status of the GEE Asset checkbox
*****************************************************************************************/
exports.selectedGEEAsset = function(){
  return gui.active_gee_asset.getValue();
}
exports.selectedPreShape = function(){
  return gui.active_preshape.getValue();
}
/****************************************************************************************
* Set the status of the GEE Asset checkbox
*****************************************************************************************/
exports.setAsset = function(assetName, layerID){
  gui.asset_textbox.setValue(assetName);
  gui.asset_LID_textbox.setValue(layerID);
  exports.AssetName = assetName;
  exports.RegionID = layerID;
}