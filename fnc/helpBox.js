/****************************************************************************************
* Help panel 
*****************************************************************************************/
var HELP_BTN_STYLE;

exports.createHelpBox = function( description, GUIPREF ){
  HELP_BTN_STYLE = {position: 'middle-left', margin:'0px -4px 4px -4px', padding: '-4px',  
        textAlign: 'left', 
        fontWeight: 'bold', fontSize: '12px', 
        color:'green', backgroundColor: GUIPREF.BACKCOLOR};
        
  exports.help_text = ui.Label({
    value: '-------------------------------------------------------------------------------------\n'+
    description + '\n' + 
    '-------------------------------------------------------------------------------------\n'+
    'The software is provided "AS IS", without warranty of any kind, express or ' +
    'implied, including but not limited to the warranties of merchantability, ' +
    'fitness for a particular purpose and noninfringement. In no event shall the ' +
    'authors or copyright holders be liable for any claim, damages or other ' +
    'liability, whether in an action of contract, tort or otherwuse, arising from, ' +
    'out of or in connection with the software or the use or other dealings in the ' +
    'software.',
    style: {position: 'top-left', margin:'10px 4px 4px 4px', padding:'0px', 
    width: '330px', whiteSpace: 'pre-wrap', color:'#44546A', 
    backgroundColor: GUIPREF.BACKCOLOR}});
  
  var help_quit = ui.Button({label: 'X',style: {position: 'top-right', color: 'red', backgroundColor: GUIPREF.BACKCOLOR}});
  exports.help_panel = ui.Panel({
    layout: ui.Panel.Layout.absolute(),
    widgets: [help_quit, exports.help_text],
    style: {width: '450px', height: '150px', color:GUIPREF.TEXTCOLOR, backgroundColor: GUIPREF.BACKCOLOR}
  });
  help_quit.onClick( function() {exports.help_panel.style().set('shown', false); });
}

exports.show_help_panel = function(text) {
  exports.help_panel.style().set('shown', true);
  exports.help_text.setValue(text);
  exports.help_panel.style().set({margin:'4px 4px 4px 4px'});
}
/********************************************************************************************
* Generate GUI help button  
********************************************************************************************/
exports.helpButton = function (text) {
  return ui.Button('?', function() {exports.show_help_panel(text)}, false, 
  HELP_BTN_STYLE);
}
