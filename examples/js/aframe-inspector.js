/* Reload the aframe dynamically, as needed
 */


$(function(){
    var x = "";
    var debuging = {};
    var gui;

    // We describe specific elements using the path from the a-scene,
    // as a list of children #'s, from top to bottom.
    // This returns a jquery selector
    function sceneElementSelector(o) {
      console.log("sceneElementSelector",o)
      if (o == "") { return "a-scene"; }
      return "a-scene > " + o.split(".").map(function(v) { 
        return ":nth-child(" + v + ")"
      }).join(" > ");
    }

    // This returns a textual descriptor
    function sceneElementDescription(o) {
     if (o == "") { return ""; }     
     var r = o.split(".").map(function(v) { 
        var i = (v < 10?" ":"") + v;
        return i; 
      }).join(" . ") + " -";
      var j = $(sceneElementSelector(o));
      if (j.prop("tagName")) {
        r += " " + j.prop("tagName");
      }
      if (j.attr("id")) {
        r += " #" + j.attr("id")
      }
      return r
    }

    function sceneElements() {
      console.log("sceneElements")
      var r = []
      function rec(o) {
        var ch = $(sceneElementSelector(o)).children();
        for(var i = 0;i < ch.length;i++) {
          var p = (o == "")?(o + (i+1)):(o + "." + (i+1))
          if ($(sceneElementSelector(p)).prop("tagName").substring(0,2) == "A-") {
            r.push(p)
            rec(p)
          }
        }        
      }
      rec("")
      return r
    }




  gui    = new dat.GUI();
  dat.GUI.prototype.removeFolder = function(name) {
    var folder = this.__folders[name];
    if (!folder) {
      return;
    }
    folder.close();
    this.__ul.removeChild(folder.domElement.parentNode);
    delete this.__folders[name];
    this.onResize();
  }
  console.log("Here");
  debug = {}
  var url = window.location

  var defaults =
           { position: new THREE.Vector3( 0, 0, 0 )
           , rotation: new THREE.Vector3( 0, 0, 0 )
           , scale:    new THREE.Vector3( 1, 1, 1 )
           , visible:  true
           };
  var steps =
           { position: 0.025
           , rotation: 1
           , scale:    0.1
           };

  active = { entity: "1"
           , position: defaults.position.clone()
           , rotation: defaults.rotation.clone()
           , scale:    defaults.scale.clone()
           , visible:  defaults.visible
           }

  
  // Insert a marker. Above the marker is HTML we have inserted, and below the marker is auto-generated.
  //      $("a-scene").prepend("<div aframe-marker></div>");

  var reloadGUI = function() {
    // We already have a gui object

    var changeEntity = function(value) {
      console.log("reloadGUI.entity",value)
      active.entity = value;
      $("[active-entity]").removeAttr("active-entity")
      var me = $(sceneElementSelector(value));
      me.attr("active-entity","true")
      function fillAttr(attr) {
        var a = me[0].getAttribute(attr)
        if (a == null) {
          a = defaults[attr]
        }
        for (var i in active[attr]) {
          active[attr][i] = a[i]
        }
      }
      fillAttr("position")
      fillAttr("rotation")
      fillAttr("scale")
    };
    var se = sceneElements()
    var entityDict = {}
    se.map(function(v) {
      entityDict[sceneElementDescription(v)] = v
    });
    active.entity = "1"
    changeEntity(se[0])

    var changePosition = function(value) {
      var me = $(sceneElementSelector(active.entity));
      me[0].setAttribute("position",active.position)
      me[0].setAttribute("rotation",active.rotation)
      me[0].setAttribute("scale",active.scale)
      me[0].setAttribute("visible",active.visible)
    }

    // Clear the inspector
    reloadGUI.entity && gui.remove(reloadGUI.entity)
    for (var i in defaults) {
      // TODO: if/then/else
      if (typeof(defaults[i]) == "boolean") {
        reloadGUI[i] && gui.remove(reloadGUI[i])
      } else {
        gui.removeFolder(i)            
      }
    }
    
    // And refill it
    reloadGUI.entity = gui.add(active, 'entity', entityDict );
    reloadGUI.entity.onChange(changeEntity);
    for (var i in defaults) {
      if (typeof(defaults[i]) == "boolean") {
        reloadGUI[i] = gui.add(active,i).listen().onChange(changePosition);
      } else { 
        var folder = gui.addFolder(i)
        var xyz = ['x','y','z'] // TODO: look this up from a table.
        for(var j in xyz) {
          console.log(i,j,active[i])
          folder.add(active[i],xyz[j]).step(steps[i]).listen().onChange(changePosition);
        }
      }
    }

  }

  // boostrap
  reloadGUI()

});

