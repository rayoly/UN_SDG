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

//Calculate the water turbidity based on sensor (LST or S3)

var LST_turbidity = function(imagecollection, param)
{
  
}

var S3_turbidity = function(imagecollection, param){
  //Sentinel-3
  /*Oa02_radiance	W m^-2 sr^-1 μm^-1	0.0133873	412.5nm/10nm  Yellow substance and detrital pigments (turbidity)
  Oa03_radiance	W m^-2 sr^-1 μm^-1	0.0121481	442.5nm/10nm	Chl absorption max., biogeochemistry, vegetation
  Oa04_radiance	W m^-2 sr^-1 μm^-1	0.0115198	490nm/10nm	High Chl, other pigments
  Oa05_radiance	W m^-2 sr^-1 μm^-1	0.0100953	510nm/10nm	Chl, sediment, turbidity, red tide
  Oa06_radiance	W m^-2 sr^-1 μm^-1	0.0123538	560nm/10nm	Chlorophyll reference (Chl minimum)
  Oa07_radiance	W m^-2 sr^-1 μm^-1	0.00879161	620nm/10nm	Sediment loading
  Oa08_radiance	W m^-2 sr^-1 μm^-1	0.00876539	665nm/10nm	Chl (2^nd Chl abs. max.), sediment, yellow substance/vegetation*/
  
  //Calculate turbidity
  imagecollection = imagecollection.map(function(img){ 
    var srcimg = ee.Image(img).select(['Oa02_radiance','Oa04_radiance','Oa05_radiance']);
    return srcimg.expression('max(A,max(B,C))',
      {'A':srcimg.select('Oa02_radiance'),
        'B':srcimg.select('Oa04_radiance'),
        'C':srcimg.select('Oa05_radiance')
      })
    .rename('turbidity')});
  return imagecollection;
}


exports.Turbidity = function(sensor, imagecollection, param){
  return ee.ImageCollection(ee.Algorithms.If(ee.String(sensor).compareTo('S3').eq(0), 
    S3_turbidity(imagecollection, param),
    LST_turbidity(imagecollection, param)));
}
