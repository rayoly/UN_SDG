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
var MaxRuralDensity = 300;
var gui = {};
exports.PopAsset = '';
exports.RuralAsset = '';
exports.performSegmentation = 0;
exports.MaxRuralDensity = 0;
exports.RuralAsset = '';
exports.Scale = 30;
/****************************************************************************************
* Define panel for selecting the AOI
*****************************************************************************************/
exports.createGUI = function(mapPanel, HELP, GUIPREF){

  gui.population_gbl_data = ui.Checkbox( {label:'Population Global Datasets', value: true, style: GUIPREF.CKBOX_STYLE} );
  gui.population_GEEasset = ui.Checkbox( {label:'Population GEE Asset:', value: false, style: GUIPREF.CKBOX_STYLE} );
  gui.help_popasset = HELP.helpButton('Enter a population dataset.');
  gui.help_ruralmask_asset = HELP.helpButton('Enter a raster rural mask (defined such that 0 in rural area, 1 in urban area). This option takes precedence over all other options.');

  //edit box to define the maximum rural population density
  gui.rural_textbox = ui.Textbox({
    placeholder: 'Max rural population density',
    style: GUIPREF.EDIT_STYLE,
    value: '300',
    onChange: function(text) {
      if((typeof text=='string' && text.length>0) || text>=0){
        exports.MaxRuralDensity = Number(text);
      }else{
        exports.MaxRuralDensity = 300;
      }    
    }
  });
  //edit box to define the population asset to use
  GUIPREF.EDIT_STYLE.width = '200px';
  gui.pop_textbox = ui.Textbox({
    placeholder: 'users/<username>/....',
    style: GUIPREF.EDIT_STYLE,
    value: '',
    onChange: function(text) {
      exports.PopAsset = text;
      if(text.length>0){
        gui.population_gbl_data.setValue(false);
        gui.population_GEEasset.setValue(true);
      }else{
        gui.population_gbl_data.setValue(true);
        gui.population_GEEasset.setValue(false);
      }
    }
  });
  gui.ruralmask_textbox = ui.Textbox({
    placeholder: 'rural mask: users/<username>/....',
    style: GUIPREF.EDIT_STYLE,
    value: '',
    onChange: function(text) {
      exports.RuralAsset = text;
    }
  });
  GUIPREF.EDIT_STYLE.width = '50px';
  gui.pop_reso_textbox = ui.Textbox({
    placeholder: 'Scale',
    style: GUIPREF.EDIT_STYLE,
    onChange: function(text) {
      if((typeof text=='string' && text.length>0) || text>=0){
        exports.Scale = Number(text);
      }else{
        exports.Scale = 1000;
      }
    }
  });
  
  //Checkbox to selecct how the rural mask is going to be generated
  gui.perform_segmentation_ck = ui.Checkbox( {
    label:'Segmentation', 
    value: exports.performSegmentation, 
    style: GUIPREF.CKBOX_STYLE,
    onChange: function (value){
      exports.performSegmentation = Number(value);
      print('Perform Segmentation:' + exports.performSegmentation);
    }
  });
  
  gui.helpseg = HELP.helpButton('If selected, will perform segmentation on all the population dataset. Otherwise, the specified rural mask or the GHSL Settlement dataset will be used for all datasets, when available!');
  //
  gui.population_gbl_data.setDisabled(true);
  gui.population_GEEasset.setDisabled(true);
  gui.rural_def = ui.Panel([ui.Label('Rural Definition:', GUIPREF.LABEL_T_STYLE),
    ui.Panel([ gui.ruralmask_textbox, gui.help_ruralmask_asset], ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE),
    ui.Panel([ gui.perform_segmentation_ck, gui.rural_textbox, ui.Label('inhab./km2', GUIPREF.LABEL_STYLE), gui.helpseg],ui.Panel.Layout.Flow('horizontal'), GUIPREF.CNTRL_PANEL_STYLE),
    ], 

  ui.Panel.Layout.Flow('vertical'), GUIPREF.CNTRL_PANEL_STYLE);

  exports.PopulationPanel = ui.Panel([
    ui.Label( 'Population:', GUIPREF.LABEL_T_STYLE),
      gui.population_gbl_data, 
      gui.population_GEEasset,
    ui.Panel([ gui.pop_textbox, gui.pop_reso_textbox, gui.help_popasset],
    ui.Panel.Layout.flow('horizontal',true), GUIPREF.CNTRL_PANEL_STYLE),
    gui.rural_def],
    'flow', GUIPREF.CNTRL_PANEL_STYLE);
};

/****************************************************************************************
* Define max rural density, when using segmentation
*****************************************************************************************/
exports.setMaxRuralDensity = function(d){
  exports.MaxRuralDensity = d;
};
/****************************************************************************************
* Define population asset
*****************************************************************************************/
exports.setPerformSegmentation = function(a){
  exports.performSegmentation = a;
  gui.perform_segmentation_ck.setValue(exports.performSegmentation);
};
/****************************************************************************************
* Define population asset
*****************************************************************************************/
exports.setPopAsset = function(a){
  exports.PopAsset = a;
  gui.pop_textbox.setValue(exports.PopAsset);
};
/****************************************************************************************
* Define rural mask
*****************************************************************************************/
exports.setRuralAsset = function(a){
  exports.RuralAsset = a;
  gui.ruralmask_textbox.setValue(exports.RuralAsset);
};
/****************************************************************************************
* 
*****************************************************************************************/
exports.selectedGEEAsset = function(){
  return (gui.population_GEEasset.getValue()===true && exports.PopAsset.length>0);
};
/****************************************************************************************
* 
*****************************************************************************************/
exports.selectedGlobalDataset = function(){
  return (gui.population_gbl_data.getValue()===true);
};
/****************************************************************************************
* 
*****************************************************************************************/
exports.getPopScale = function(){
  return Number(gui.pop_reso_textbox.getValue());
};