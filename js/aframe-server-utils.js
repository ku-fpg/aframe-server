/* Reload the aframe dynamically, as needed
 */

function ServerUtils () {

  // (From aframe-editor)
  // Detect if the scene is already loaded
  if (document.readyState === 'complete' || document.readyState === 'loaded') {
    this.onDomLoaded();
  } else {
    document.addEventListener('DOMContentLoaded', this.onDomLoaded.bind(this));
  }
}

ServerUtils.prototype = {

  onDomLoaded: function () {
    this.sceneEl = document.querySelector('a-scene');
    if (this.sceneEl.hasLoaded) {
      this.onSceneLoaded();
    } else {
      this.sceneEl.addEventListener('loaded', this.onSceneLoaded.bind(this));
    }
  },

  onSceneLoaded: function () {
    this.loadScene("HEAD")
  },
  loadScene: function(ty) {
    var version = $("a-scene").attr("version");
    if (version == undefined || ty == "RELOAD") {
      // do this the slow way
      $.get( "/scene", this.resetScene.bind(this));
    } else {
      // check for changes
      $.getJSON( "/status/" + version, this.updateScene.bind(this));          
    }
  },
  updateScene: function(d) {
//    console.log("updateScene",d)
    if (d.change && d.change == "HEAD") {
      this.loadScene("HEAD");
    } else if (d.change && d.change == "DELTAS") {
      console.log("DELTAS",d)
      d.changes.forEach(function(o) {
        var q = o.path[0];
        for (var i = 1;i < o.path.length;i+=2) {
          q += " > " + o.path[i+1] + ":nth-of-type(" + (o.path[i]+1) + ")"
        }
        // This is where we do the micro-updates
        $(q).attr(o.attr,o.value);
        console.log(o,q);
      });
      this.loadScene("HEAD");  // try reload the scene
    } else {
      this.loadScene("RELOAD");
    }
  },
  resetScene: function(data) {
    if ($("a-scene").length == 0) {
      // Now should never happen,
      // but if it does, just load the DOM directly.
      $("body").prepend(data);
    } else {
      var ch = $("a-scene").children();
      for(i = 0;i < ch.length;i++) {
        if (!ch[i].localName
              || ch[i].localName == "canvas"
              || ch[i].localName == "div"
              || ch[i].localName == "a-camera" 
              || !ch[i].attributes
              || (ch[i].localName == "a-entity" 
                   && (ch[i].attributes["camera"] || $(ch[i]).find("a-entity[camera]").length > 0 || $(ch[i]).find("a-camera").length > 0))
              || ch[i].attributes["data-aframe-default-light"]
              || ch[i].attributes["data-aframe-default-camera"]
        ) {
//              console.log("leaving " + i);
        } else {
//              console.log("removing " + i)
          // This appears to be leaving the Three.js Gemoetries behind. 
          // TODO: check into this
          $(ch[i]).remove()
        }
      }
//          console.log("childern",$("a-scene").children())
      // repace a-scene with x-scene to avoid triggering the a-scene callback
      // (which inserts the defaults, and therefor makes two camera, which confuses
      //  the THREE.js sub-system). Note replace only replaces the *first* 
      // a-scene of the string, so will not effect any properties.
      var xml = $(data.replace("a-scene","x-scene"));
      // Remove the camera, if there is an (explicit) one.
      // The camera is never dynamically updated (but controlled by the in-browser tools)
      xml.find("a-entity[camera]").remove()

//      console.log(xml)
      xml.children().prependTo("a-scene");
  
      debug_xml = xml;
      $("a-scene").attr("version",xml.attr("version"))  // update the version number
    }
    this.loadScene("HEAD");
  }
  
};

module.exports = new ServerUtils();

/*
$(function(){
  
  // Every second, update the scene
  var sceneText = "";
  var resetScene = function(data) {
//        console.log("checking")
    if (data == sceneText) {
        setTimeout(loadScene,1000)
        return;
    }
    sceneText = data;
    x = sceneText;
    
    if ($("a-scene").length == 0) {
      // Now should never happen
      $("body").prepend(data);
    } else {
      var ch = $("a-scene").children();
      for(i = 0;i < ch.length;i++) {
        if (!ch[i].localName
              || ch[i].localName == "canvas"
              || ch[i].localName == "div"
              || ch[i].localName == "a-camera" 
              || !ch[i].attributes
              || (ch[i].localName == "a-entity" 
                   && (ch[i].attributes["camera"] || $(ch[i]).find("a-entity[camera]").length > 0 || $(ch[i]).find("a-camera").length > 0))
              || ch[i].attributes["data-aframe-default-light"]
              || ch[i].attributes["data-aframe-default-camera"]
        ) {
//              console.log("leaving " + i);
        } else {
//              console.log("removing " + i)
          // This appears to be leaving the Three.js Gemoetries behind. 
          // TODO: check into this
          $(ch[i]).remove()
        }
      }
//          console.log("childern",$("a-scene").children())
      // repace a-scene with x-scene to avoid triggering the a-scene callback
      // (which inserts the defaults, and therefor makes two camera, which confuses
      //  the THREE.js sub-system). Note replace only replaces the *first* 
      // a-scene of the string, so will not effect any properties.
      var xml = $(data.replace("a-scene","x-scene"));
      // Remove the camera, if there is an (explicit) one.
      // The camera is never dynamically updated (but controlled by the in-browser tools)
      xml.find("a-entity[camera]").remove()

//      console.log(xml)
      xml.children().prependTo("a-scene");
  
      debug_xml = xml;
      $("a-scene").attr("version",xml.attr("version"))  // update the version number
    }
    setTimeout(loadScene,1000)
  }
  var updateScene = function(d) {
//    console.log("updateScene",d)
    if (d.change && d.change == "HEAD") {
      return loadScene();
    } else {
      loadScene("RELOAD");
    }
  }
  var loadScene = function(ty) {
    var version = $("a-scene").attr("version");
    if (version == undefined || ty == "RELOAD") {
      // do this the slow way
      $.get( "/scene", resetScene);
    } else {
      // check for changes
      $.getJSON( "/status/" + version, updateScene);          
    }
  }
  loadScene("HEAD")
});

*/