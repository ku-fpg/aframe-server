# aframe-server
Shared server-based space for A-Frame scenes.

## usage

````
aframe-server <path-to-scene.html>
````

Loads server, and stores the internal `a-scene` for modification.

### Regular web serving

There are a number of reflections of the scene HTML file. The "pull" pages can
always be reloaded to get the lastest updates.

COMMAND               | Action                         | Push/Pull | Notes
----------------------|--------------------------------|--------|-----
GET /                 | Gets the *latest* scene        | -      | Latest `AFrame` is injected into a static webpage
GET /scene.html       | Gets the *latest* scene        | push   | Scene is automatically updated
GET /editable.html    | Gets the *latest* scene        | pull   | Scene changes are sent back into the server; no automatic updating
GET /gui.html         | editable, with a gui inspector | pull   | Scene changes are pushed back

### Serving assets, JavaScript, etc.

COMMAND               | Action                         | Format | Notes
----------------------|--------------------------------|--------|-----
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
