# aframe-server

Shared server-based space for A-Frame scene. Provides mechanisms for dynamically updating and edits scenes,
and sharing them between browsers.

## usage

````
aframe-server <path-to-scene.html>
````

Loads server, and stores the internal `a-scene` for modification.

## Server API

### Regular web serving

There are a number of reflections of the scene HTML file.

COMMAND           | Push / Pull  | Notes
------------------|--------------|-----------
GET /             |              | Landing page for viewing and editing scene 
GET /static.html  |              | Latest `AFrame` is injected into a *static* webpage
GET /dynamic.html | Push Only    | Latest `AFrame`, and Scene is automatically updated
GET /edit.html    | Push & Pull  | Scene is automatically updated, and changes back to a shadow `AFrame`

### Serving assets, JavaScript, etc.

Basically a regular web server with regard to files.

COMMAND               | Action                         | Format | Notes
----------------------|--------------------------------|--------|-----
GET /js/foo.js  (etc) | Get a js file                  | JS     | Must be in same root as path-to-scene

The path `/static` is reserved for internal (typically injected) files.

### CRUD web serving


COMMAND    | Action                        | Format
-----------|-------------------------------|--------
GET /scene | Gets the whole (latest) scene | XML
GET /status/N | Ask about version #N       | { "change": "HEAD" or "RELOAD" }

Assets and Libraries under different LICENSE.

 * Fox from http://pngimg.com/img/animals/fox, free download
 * tree1 and 2, etc, taken from aframe-gamepad-controls, which was taken from aframe demo
 * We use `dat.gui.js`, from https://github.com/dataarts/dat.gui.
