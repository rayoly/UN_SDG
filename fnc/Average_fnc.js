/****************************************************************************************
* 
*****************************************************************************************/
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