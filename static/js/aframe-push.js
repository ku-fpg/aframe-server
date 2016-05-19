/* Reload the aframe dynamically, as needed
 */

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

