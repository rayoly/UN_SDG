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
This script's functions return average and 5-year average based on input array
-----------------------------------------------------------------------------------------*/
exports.Average = function(array){
  var avg;
  if(array.length===0){
    avg = 0;  
  }else{
    avg = array.reduce(function(a, b) { return a + b; })/array.length;
  }
  return avg;
}

exports.Average5 = function(array, index){
  var tmparray = array.slice();
  var N = tmparray.length;
  while(N<=index+5){
    tmparray.push(0);
    N = N + 1;
  }
  var avg = exports.Average(tmparray.slice(index,index+5));
  
  return avg;
}