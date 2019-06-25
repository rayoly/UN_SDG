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
This script generate a GUI for the selection of an reference date (year, month, day)
Requires: AOI, helpBox, GUIPREF
-----------------------------------------------------------------------------------------*/

exports.Year = 0;
exports.Month = 'All';
exports.Day = 'All';

exports.YearList = ['2000','2005','2010','2015','2020'];
exports.MonthList = ['All','01','02','03','04','05','06','07','08','09','10','11','12'];
exports.DayList = Array.apply(null, {length: 32}).map( function(number, index){return index.toString()});
exports.DayList[0] = 'All';


exports.setYearList = function( yearlist ){
  exports.YearList = yearlist;
}
exports.setMonthList = function( monthlist ){
  exports.MonthList = monthlist;
}
/****************************************************************************************
* Define panel for selecting the AOI
*****************************************************************************************/
exports.createGUI = function(mapPanel, help, guipref, addyear, addmonth, addday){
  if(typeof exports.YearList === 'undefined'){
    exports.YearList = '2019';
  }
  if(typeof exports.MonthList === 'undefined'){
    exports.MonthList = 'All';
  }
  if(typeof exports.DayList === 'undefined'){
    exports.DayList = 'All';
  }  
  //------------------------------------------------------------ Create the country pulldown
  exports.yearSelect = ui.Select({
    items: exports.YearList,
    value: exports.YearList[1],
    style: guipref.SELECT_STYLE,
    onChange: function(year) {
    exports.Year = year;
    }
  });
  exports.monthSelect = ui.Select({
  items: exports.MonthList,
  value: exports.MonthList[0],
  style: guipref.SELECT_STYLE,
  onChange: function(month) {
    exports.Month = month;    
    }
  });
  exports.daySelect = ui.Select({
  items: exports.DayList,
  value: exports.DayList[0],
  style: guipref.SELECT_STYLE,
  onChange: function(day) {
    exports.Day = day;    
    }
  });
  
  //disable/hide what is not needed
  if(typeof addyear==='undefined' || addyear===false){
    exports.yearSelect.setDisabled(true);
  }
  if(typeof addmonth==='undefined' || addmonth===false){
    exports.monthSelect.setDisabled(true);
    exports.monthSelect.style().set('shown',false);
  }
  if(typeof addday==='undefined' || addday===false){
    exports.daySelect.setDisabled(true);
    exports.daySelect.style().set('shown',false);
  }  
  //Set starting values
  exports.yearSelect.setValue(exports.YearList[0]);
  exports.monthSelect.setValue(exports.MonthList[0]);
  exports.daySelect.setValue(exports.DayList[0]);
  
  //Add the select to the toolPanel with some explanatory text.
  exports.datePanel = ui.Panel([
    ui.Label( 'Reference Date:', guipref.LABEL_T_STYLE), 
    exports.yearSelect, exports.monthSelect, exports.daySelect],
    ui.Panel.Layout.flow('horizontal',true), guipref.CNTRL_SUBPANEL_STYLE);
}


exports.DateRange = function(year, month){
  var nbDay = ee.List([0,31,28,31,30,31,30,31,31,30,31,30,31]);
  
  var m = ee.Number.parse(ee.String(month));

  var datestart = ee.Date.fromYMD(ee.Number.parse(ee.String(year)),m, 1);
  var dateend = ee.Date.fromYMD(ee.Number.parse(ee.String(year)), m, nbDay.get(m) );
  
  var DateStart = ee.String(ee.Algorithms.If(ee.String(month).compareTo('All').eq(0),
    ee.String(year).cat('-01-01'),
    ee.String(year).cat('-').cat(month).cat('-01')));
    
  var DateEnd = ee.String(ee.Algorithms.If(ee.String(month).compareTo('All').eq(0),
    ee.String(year).cat('-12-31'),
    dateend.format('yyyy-MM-dd')));
    
    
  return ee.List([DateStart, DateEnd]);
  
}

exports.setYear = function(year){
  exports.yearSelect.setValue(year);
}
exports.setMonth = function(month){
  exports.monthSelect.setValue(month);
}
