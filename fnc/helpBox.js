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
This script generates a GUI for the help as well as help buttons
-----------------------------------------------------------------------------------------*/

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
