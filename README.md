# aframe-server
Shared server-based space for A-Frame scenes.

## usage

````
aframe-server <path-to-scene.html>
````

Loads server, and stores the internal `a-scene` for modification.

### Regular web serving

COMMAND               | Action                         | Format | Notes
----------------------|--------------------------------|--------|-----
GET /                 | Gets the *latest* scene        | HTML   | Latest `AFrame` is injected into a static webpage
GET /scene.html       | Gets the *latest* scene        | HTML   | Scene is automatically updated
GET /editable.html    | Gets the *latest* scene        | HTML   | Scene changes are pull'ed back into the server
GET /gui.html         | editable, with a gui inspector | HTML   | Scene changes are pushed back
GET /js/foo.js  (etc) | Get a js file                  | JS     | Must be in same root as path-to-scene

The path `/static` is reserved for internal (typically injected) files.

### CRUD web serving


COMMAND    | Action                   | Format
-----------|--------------------------|--------
GET /scene | Gets the whole scene     | XML
GET /status/N | Ask about version #N  | { "change": "HEAD" or "RELOAD" }

Assets
 * Fox from http://pngimg.com/img/animals/fox, free download
 * tree1 and 2, etc, taken from aframe-gamepad-controls, which was taken from aframe demo
