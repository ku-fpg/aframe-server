# aframe-server
Shared server-based space for A-Frame scenes.

## usage

````
aframe-server <path-to-scene.html>
````

### Regular web serving

COMMAND    | Action                   | Format
-----------+--------------------------+--------
GET /      | Gets the scene           | HTML
GET /js/foo.js | Get a js file        | JS


The path `/static` is reserved for internal (typically injected) files.

### CRUD web serving


COMMAND    | Action                   | Format
-----------|--------------------------|--------
GET /scene | Gets the whole scene     | XML
POST /scene | updates the whole scene | XML
GET /scene/ABC | Gets resource #ABC   | XML
PUT /scene/ABC | Sets resource #ABC   | XML 


Assets
 * Fox from http://pngimg.com/img/animals/fox, free download
 * tree1 and 2, etc, taken from aframe-gamepad-controls, which was taken from aframe demo
