# aframe-server
Shared server-based space for A-Frame scenes.

## usage

````
aframe-server <path-to-scene.html>
````

Loads server, and stores the internal `a-scene` for modification.

### Regular web serving

COMMAND         | Action                   | Format | Notes
----------------|--------------------------|--------|-----
GET /           | Gets the *latest* scene  | HTML   | Latest `AFrame` is injected
GET /js/foo.js  | Get a js file            | JS     | Must be in same root as path-to-scene
GET /css/foo.css| Get a css file           | CSS    | etc, etc.


The path `/static` is reserved for internal (typically injected) files.

### CRUD web serving


COMMAND    | Action                   | Format
-----------|--------------------------|--------
GET /scene | Gets the whole scene     | XML
GET /status/N | Ask about version #N  | { "change": "HEAD" or "RELOAD" }

Assets
 * Fox from http://pngimg.com/img/animals/fox, free download
 * tree1 and 2, etc, taken from aframe-gamepad-controls, which was taken from aframe demo
