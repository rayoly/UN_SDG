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
This script is used to export the content of the Map to GDrive
-----------------------------------------------------------------------------------------*/

/****************************************************************************************
*  
*****************************************************************************************/
exports.exportMap = function(mapPanel, description, scale, poly, export_crs){
  
  var layername = '';
  var image;
  var layer;
  var n;
  
  for(n=0; n<mapPanel.layers().length(); n++){
    
    layer = mapPanel.layers().get(n);
    image = layer.get('eeObject');
    layername = layer.get('name');
  
    Export.image.toDrive({
        image: image,
        description: description + '_' + layername,
        scale: scale,
        region: poly,
        maxPixels: 1e10,
        skipEmptyTiles: false,
        crs: export_crs,
        fileFormat: 'GeoTIFF'
        });
  }
}
