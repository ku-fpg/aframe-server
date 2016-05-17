# aframe-server
Shared server-based space for A-Frame scenes.

## usage

````
aframe-server <path-to-scene.html>
````

### Regular web serving

COMMAND         | Action                   | Format | Notes
----------------+--------------------------+--------+-----
GET /           | Gets the *latest* scene  | HTML   | Latest AFrame is injected
GET /js/foo.js  | Get a js file            | JS     | Must be in same root as path-to-scene
GET /css/foo.css| Get a css file           | CSS    | etc, etc.


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
