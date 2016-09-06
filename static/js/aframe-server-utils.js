(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.aframeServerUtils = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* Reload the aframe dynamically, as needed. Put the scene back to the server, as needed.
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
    // Everything is ready to go.
    // From http://stackoverflow.com/questions/979975/how-to-get-the-value-from-the-get-parameters
    var params = window.location.search
      .substring(1)
      .split("&")
      .map(v => v.split("="))
      .reduce((map, [key, value]) => map.set(key, decodeURIComponent(value)), new Map())
    console.log("onSceneLoaded !",params);
    // Do we need to send the edited Scene back to the server periodically?
    if (params.get("edit") != undefined) {
      console.log("edit key (s+cntl+alt) enabled");
      this.onKeydown = this.onKeydown.bind(this);
      window.addEventListener('keydown', this.onKeydown);
      this.pushScene(); // And also push back the initial version of the scene to the shadow AFrame Object.
    } else {
      console.log("did not find edit");
    }
    this.loadScene("HEAD")    
  },
  onKeydown: function (evt) {
    // Alt + Ctrl + s
    console.log("onKeydown",evt)
    var shortcutPressed = evt.keyCode === 83 && evt.ctrlKey && evt.altKey;
    if (!shortcutPressed) { return; }
    this.pushScene();
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
  },
  pushScene: function() {
    console.log("pushScene")
    var that = this;
    $.ajax(
      { type: "PUT",
        url: "/scene",
        data: document.getElementsByTagName('body')[0].innerHTML,
        contentType:  'text/plain; charset=UTF-8',
        dataType: "json",     // result type
        cache: false,
        error: function() {
//          console.log("Failed to send DOM; retrying");
        },
        success: function(xml) {
//             alert("it works");
//           alert($(xml).find("project")[0].attr("id"));
      }
    });
    console.log("pushScene ...");
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
},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9hZnJhbWUtc2VydmVyLXV0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qIFJlbG9hZCB0aGUgYWZyYW1lIGR5bmFtaWNhbGx5LCBhcyBuZWVkZWQuIFB1dCB0aGUgc2NlbmUgYmFjayB0byB0aGUgc2VydmVyLCBhcyBuZWVkZWQuXG4gKi9cblxuZnVuY3Rpb24gU2VydmVyVXRpbHMgKCkge1xuXG4gIC8vIChGcm9tIGFmcmFtZS1lZGl0b3IpXG4gIC8vIERldGVjdCBpZiB0aGUgc2NlbmUgaXMgYWxyZWFkeSBsb2FkZWRcbiAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdjb21wbGV0ZScgfHwgZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRlZCcpIHtcbiAgICB0aGlzLm9uRG9tTG9hZGVkKCk7XG4gIH0gZWxzZSB7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIHRoaXMub25Eb21Mb2FkZWQuYmluZCh0aGlzKSk7XG4gIH1cbn1cblxuU2VydmVyVXRpbHMucHJvdG90eXBlID0ge1xuXG4gIG9uRG9tTG9hZGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5zY2VuZUVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYS1zY2VuZScpO1xuICAgIGlmICh0aGlzLnNjZW5lRWwuaGFzTG9hZGVkKSB7XG4gICAgICB0aGlzLm9uU2NlbmVMb2FkZWQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zY2VuZUVsLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZCcsIHRoaXMub25TY2VuZUxvYWRlZC5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH0sXG5cbiAgb25TY2VuZUxvYWRlZDogZnVuY3Rpb24gKCkge1xuICAgIC8vIEV2ZXJ5dGhpbmcgaXMgcmVhZHkgdG8gZ28uXG4gICAgLy8gRnJvbSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzk3OTk3NS9ob3ctdG8tZ2V0LXRoZS12YWx1ZS1mcm9tLXRoZS1nZXQtcGFyYW1ldGVyc1xuICAgIHZhciBwYXJhbXMgPSB3aW5kb3cubG9jYXRpb24uc2VhcmNoXG4gICAgICAuc3Vic3RyaW5nKDEpXG4gICAgICAuc3BsaXQoXCImXCIpXG4gICAgICAubWFwKHYgPT4gdi5zcGxpdChcIj1cIikpXG4gICAgICAucmVkdWNlKChtYXAsIFtrZXksIHZhbHVlXSkgPT4gbWFwLnNldChrZXksIGRlY29kZVVSSUNvbXBvbmVudCh2YWx1ZSkpLCBuZXcgTWFwKCkpXG4gICAgY29uc29sZS5sb2coXCJvblNjZW5lTG9hZGVkICFcIixwYXJhbXMpO1xuICAgIC8vIERvIHdlIG5lZWQgdG8gc2VuZCB0aGUgZWRpdGVkIFNjZW5lIGJhY2sgdG8gdGhlIHNlcnZlciBwZXJpb2RpY2FsbHk/XG4gICAgaWYgKHBhcmFtcy5nZXQoXCJlZGl0XCIpICE9IHVuZGVmaW5lZCkge1xuICAgICAgY29uc29sZS5sb2coXCJlZGl0IGtleSAocytjbnRsK2FsdCkgZW5hYmxlZFwiKTtcbiAgICAgIHRoaXMub25LZXlkb3duID0gdGhpcy5vbktleWRvd24uYmluZCh0aGlzKTtcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5vbktleWRvd24pO1xuICAgICAgdGhpcy5wdXNoU2NlbmUoKTsgLy8gQW5kIGFsc28gcHVzaCBiYWNrIHRoZSBpbml0aWFsIHZlcnNpb24gb2YgdGhlIHNjZW5lIHRvIHRoZSBzaGFkb3cgQUZyYW1lIE9iamVjdC5cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coXCJkaWQgbm90IGZpbmQgZWRpdFwiKTtcbiAgICB9XG4gICAgdGhpcy5sb2FkU2NlbmUoXCJIRUFEXCIpICAgIFxuICB9LFxuICBvbktleWRvd246IGZ1bmN0aW9uIChldnQpIHtcbiAgICAvLyBBbHQgKyBDdHJsICsgc1xuICAgIGNvbnNvbGUubG9nKFwib25LZXlkb3duXCIsZXZ0KVxuICAgIHZhciBzaG9ydGN1dFByZXNzZWQgPSBldnQua2V5Q29kZSA9PT0gODMgJiYgZXZ0LmN0cmxLZXkgJiYgZXZ0LmFsdEtleTtcbiAgICBpZiAoIXNob3J0Y3V0UHJlc3NlZCkgeyByZXR1cm47IH1cbiAgICB0aGlzLnB1c2hTY2VuZSgpO1xuICB9LFxuICBsb2FkU2NlbmU6IGZ1bmN0aW9uKHR5KSB7XG4gICAgdmFyIHZlcnNpb24gPSAkKFwiYS1zY2VuZVwiKS5hdHRyKFwidmVyc2lvblwiKTtcbiAgICBpZiAodmVyc2lvbiA9PSB1bmRlZmluZWQgfHwgdHkgPT0gXCJSRUxPQURcIikge1xuICAgICAgLy8gZG8gdGhpcyB0aGUgc2xvdyB3YXlcbiAgICAgICQuZ2V0KCBcIi9zY2VuZVwiLCB0aGlzLnJlc2V0U2NlbmUuYmluZCh0aGlzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNoZWNrIGZvciBjaGFuZ2VzXG4gICAgICAkLmdldEpTT04oIFwiL3N0YXR1cy9cIiArIHZlcnNpb24sIHRoaXMudXBkYXRlU2NlbmUuYmluZCh0aGlzKSk7ICAgICAgICAgIFxuICAgIH1cbiAgfSxcbiAgdXBkYXRlU2NlbmU6IGZ1bmN0aW9uKGQpIHtcbi8vICAgIGNvbnNvbGUubG9nKFwidXBkYXRlU2NlbmVcIixkKVxuICAgIGlmIChkLmNoYW5nZSAmJiBkLmNoYW5nZSA9PSBcIkhFQURcIikge1xuICAgICAgdGhpcy5sb2FkU2NlbmUoXCJIRUFEXCIpO1xuICAgIH0gZWxzZSBpZiAoZC5jaGFuZ2UgJiYgZC5jaGFuZ2UgPT0gXCJERUxUQVNcIikge1xuICAgICAgY29uc29sZS5sb2coXCJERUxUQVNcIixkKVxuICAgICAgZC5jaGFuZ2VzLmZvckVhY2goZnVuY3Rpb24obykge1xuICAgICAgICB2YXIgcSA9IG8ucGF0aFswXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7aSA8IG8ucGF0aC5sZW5ndGg7aSs9Mikge1xuICAgICAgICAgIHEgKz0gXCIgPiBcIiArIG8ucGF0aFtpKzFdICsgXCI6bnRoLW9mLXR5cGUoXCIgKyAoby5wYXRoW2ldKzEpICsgXCIpXCJcbiAgICAgICAgfVxuICAgICAgICAvLyBUaGlzIGlzIHdoZXJlIHdlIGRvIHRoZSBtaWNyby11cGRhdGVzXG4gICAgICAgICQocSkuYXR0cihvLmF0dHIsby52YWx1ZSk7XG4gICAgICAgIGNvbnNvbGUubG9nKG8scSk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMubG9hZFNjZW5lKFwiSEVBRFwiKTsgIC8vIHRyeSByZWxvYWQgdGhlIHNjZW5lXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubG9hZFNjZW5lKFwiUkVMT0FEXCIpO1xuICAgIH1cbiAgfSxcbiAgcmVzZXRTY2VuZTogZnVuY3Rpb24oZGF0YSkge1xuICAgIGlmICgkKFwiYS1zY2VuZVwiKS5sZW5ndGggPT0gMCkge1xuICAgICAgLy8gTm93IHNob3VsZCBuZXZlciBoYXBwZW4sXG4gICAgICAvLyBidXQgaWYgaXQgZG9lcywganVzdCBsb2FkIHRoZSBET00gZGlyZWN0bHkuXG4gICAgICAkKFwiYm9keVwiKS5wcmVwZW5kKGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY2ggPSAkKFwiYS1zY2VuZVwiKS5jaGlsZHJlbigpO1xuICAgICAgZm9yKGkgPSAwO2kgPCBjaC5sZW5ndGg7aSsrKSB7XG4gICAgICAgIGlmICghY2hbaV0ubG9jYWxOYW1lXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImNhbnZhc1wiXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImRpdlwiXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImEtY2FtZXJhXCIgXG4gICAgICAgICAgICAgIHx8ICFjaFtpXS5hdHRyaWJ1dGVzXG4gICAgICAgICAgICAgIHx8IChjaFtpXS5sb2NhbE5hbWUgPT0gXCJhLWVudGl0eVwiIFxuICAgICAgICAgICAgICAgICAgICYmIChjaFtpXS5hdHRyaWJ1dGVzW1wiY2FtZXJhXCJdIHx8ICQoY2hbaV0pLmZpbmQoXCJhLWVudGl0eVtjYW1lcmFdXCIpLmxlbmd0aCA+IDAgfHwgJChjaFtpXSkuZmluZChcImEtY2FtZXJhXCIpLmxlbmd0aCA+IDApKVxuICAgICAgICAgICAgICB8fCBjaFtpXS5hdHRyaWJ1dGVzW1wiZGF0YS1hZnJhbWUtZGVmYXVsdC1saWdodFwiXVxuICAgICAgICAgICAgICB8fCBjaFtpXS5hdHRyaWJ1dGVzW1wiZGF0YS1hZnJhbWUtZGVmYXVsdC1jYW1lcmFcIl1cbiAgICAgICAgKSB7XG4vLyAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJsZWF2aW5nIFwiICsgaSk7XG4gICAgICAgIH0gZWxzZSB7XG4vLyAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJyZW1vdmluZyBcIiArIGkpXG4gICAgICAgICAgLy8gVGhpcyBhcHBlYXJzIHRvIGJlIGxlYXZpbmcgdGhlIFRocmVlLmpzIEdlbW9ldHJpZXMgYmVoaW5kLiBcbiAgICAgICAgICAvLyBUT0RPOiBjaGVjayBpbnRvIHRoaXNcbiAgICAgICAgICAkKGNoW2ldKS5yZW1vdmUoKVxuICAgICAgICB9XG4gICAgICB9XG4vLyAgICAgICAgICBjb25zb2xlLmxvZyhcImNoaWxkZXJuXCIsJChcImEtc2NlbmVcIikuY2hpbGRyZW4oKSlcbiAgICAgIC8vIHJlcGFjZSBhLXNjZW5lIHdpdGggeC1zY2VuZSB0byBhdm9pZCB0cmlnZ2VyaW5nIHRoZSBhLXNjZW5lIGNhbGxiYWNrXG4gICAgICAvLyAod2hpY2ggaW5zZXJ0cyB0aGUgZGVmYXVsdHMsIGFuZCB0aGVyZWZvciBtYWtlcyB0d28gY2FtZXJhLCB3aGljaCBjb25mdXNlc1xuICAgICAgLy8gIHRoZSBUSFJFRS5qcyBzdWItc3lzdGVtKS4gTm90ZSByZXBsYWNlIG9ubHkgcmVwbGFjZXMgdGhlICpmaXJzdCogXG4gICAgICAvLyBhLXNjZW5lIG9mIHRoZSBzdHJpbmcsIHNvIHdpbGwgbm90IGVmZmVjdCBhbnkgcHJvcGVydGllcy5cbiAgICAgIHZhciB4bWwgPSAkKGRhdGEucmVwbGFjZShcImEtc2NlbmVcIixcIngtc2NlbmVcIikpO1xuICAgICAgLy8gUmVtb3ZlIHRoZSBjYW1lcmEsIGlmIHRoZXJlIGlzIGFuIChleHBsaWNpdCkgb25lLlxuICAgICAgLy8gVGhlIGNhbWVyYSBpcyBuZXZlciBkeW5hbWljYWxseSB1cGRhdGVkIChidXQgY29udHJvbGxlZCBieSB0aGUgaW4tYnJvd3NlciB0b29scylcbiAgICAgIHhtbC5maW5kKFwiYS1lbnRpdHlbY2FtZXJhXVwiKS5yZW1vdmUoKVxuXG4vLyAgICAgIGNvbnNvbGUubG9nKHhtbClcbiAgICAgIHhtbC5jaGlsZHJlbigpLnByZXBlbmRUbyhcImEtc2NlbmVcIik7XG4gIFxuICAgICAgZGVidWdfeG1sID0geG1sO1xuICAgICAgJChcImEtc2NlbmVcIikuYXR0cihcInZlcnNpb25cIix4bWwuYXR0cihcInZlcnNpb25cIikpICAvLyB1cGRhdGUgdGhlIHZlcnNpb24gbnVtYmVyXG4gICAgfVxuICAgIHRoaXMubG9hZFNjZW5lKFwiSEVBRFwiKTtcbiAgfSxcbiAgcHVzaFNjZW5lOiBmdW5jdGlvbigpIHtcbiAgICBjb25zb2xlLmxvZyhcInB1c2hTY2VuZVwiKVxuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAkLmFqYXgoXG4gICAgICB7IHR5cGU6IFwiUFVUXCIsXG4gICAgICAgIHVybDogXCIvc2NlbmVcIixcbiAgICAgICAgZGF0YTogZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2JvZHknKVswXS5pbm5lckhUTUwsXG4gICAgICAgIGNvbnRlbnRUeXBlOiAgJ3RleHQvcGxhaW47IGNoYXJzZXQ9VVRGLTgnLFxuICAgICAgICBkYXRhVHlwZTogXCJqc29uXCIsICAgICAvLyByZXN1bHQgdHlwZVxuICAgICAgICBjYWNoZTogZmFsc2UsXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbigpIHtcbi8vICAgICAgICAgIGNvbnNvbGUubG9nKFwiRmFpbGVkIHRvIHNlbmQgRE9NOyByZXRyeWluZ1wiKTtcbiAgICAgICAgfSxcbiAgICAgICAgc3VjY2VzczogZnVuY3Rpb24oeG1sKSB7XG4vLyAgICAgICAgICAgICBhbGVydChcIml0IHdvcmtzXCIpO1xuLy8gICAgICAgICAgIGFsZXJ0KCQoeG1sKS5maW5kKFwicHJvamVjdFwiKVswXS5hdHRyKFwiaWRcIikpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGNvbnNvbGUubG9nKFwicHVzaFNjZW5lIC4uLlwiKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBuZXcgU2VydmVyVXRpbHMoKTtcblxuLypcbiQoZnVuY3Rpb24oKXtcbiAgXG4gIC8vIEV2ZXJ5IHNlY29uZCwgdXBkYXRlIHRoZSBzY2VuZVxuICB2YXIgc2NlbmVUZXh0ID0gXCJcIjtcbiAgdmFyIHJlc2V0U2NlbmUgPSBmdW5jdGlvbihkYXRhKSB7XG4vLyAgICAgICAgY29uc29sZS5sb2coXCJjaGVja2luZ1wiKVxuICAgIGlmIChkYXRhID09IHNjZW5lVGV4dCkge1xuICAgICAgICBzZXRUaW1lb3V0KGxvYWRTY2VuZSwxMDAwKVxuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHNjZW5lVGV4dCA9IGRhdGE7XG4gICAgeCA9IHNjZW5lVGV4dDtcbiAgICBcbiAgICBpZiAoJChcImEtc2NlbmVcIikubGVuZ3RoID09IDApIHtcbiAgICAgIC8vIE5vdyBzaG91bGQgbmV2ZXIgaGFwcGVuXG4gICAgICAkKFwiYm9keVwiKS5wcmVwZW5kKGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY2ggPSAkKFwiYS1zY2VuZVwiKS5jaGlsZHJlbigpO1xuICAgICAgZm9yKGkgPSAwO2kgPCBjaC5sZW5ndGg7aSsrKSB7XG4gICAgICAgIGlmICghY2hbaV0ubG9jYWxOYW1lXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImNhbnZhc1wiXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImRpdlwiXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImEtY2FtZXJhXCIgXG4gICAgICAgICAgICAgIHx8ICFjaFtpXS5hdHRyaWJ1dGVzXG4gICAgICAgICAgICAgIHx8IChjaFtpXS5sb2NhbE5hbWUgPT0gXCJhLWVudGl0eVwiIFxuICAgICAgICAgICAgICAgICAgICYmIChjaFtpXS5hdHRyaWJ1dGVzW1wiY2FtZXJhXCJdIHx8ICQoY2hbaV0pLmZpbmQoXCJhLWVudGl0eVtjYW1lcmFdXCIpLmxlbmd0aCA+IDAgfHwgJChjaFtpXSkuZmluZChcImEtY2FtZXJhXCIpLmxlbmd0aCA+IDApKVxuICAgICAgICAgICAgICB8fCBjaFtpXS5hdHRyaWJ1dGVzW1wiZGF0YS1hZnJhbWUtZGVmYXVsdC1saWdodFwiXVxuICAgICAgICAgICAgICB8fCBjaFtpXS5hdHRyaWJ1dGVzW1wiZGF0YS1hZnJhbWUtZGVmYXVsdC1jYW1lcmFcIl1cbiAgICAgICAgKSB7XG4vLyAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJsZWF2aW5nIFwiICsgaSk7XG4gICAgICAgIH0gZWxzZSB7XG4vLyAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJyZW1vdmluZyBcIiArIGkpXG4gICAgICAgICAgLy8gVGhpcyBhcHBlYXJzIHRvIGJlIGxlYXZpbmcgdGhlIFRocmVlLmpzIEdlbW9ldHJpZXMgYmVoaW5kLiBcbiAgICAgICAgICAvLyBUT0RPOiBjaGVjayBpbnRvIHRoaXNcbiAgICAgICAgICAkKGNoW2ldKS5yZW1vdmUoKVxuICAgICAgICB9XG4gICAgICB9XG4vLyAgICAgICAgICBjb25zb2xlLmxvZyhcImNoaWxkZXJuXCIsJChcImEtc2NlbmVcIikuY2hpbGRyZW4oKSlcbiAgICAgIC8vIHJlcGFjZSBhLXNjZW5lIHdpdGggeC1zY2VuZSB0byBhdm9pZCB0cmlnZ2VyaW5nIHRoZSBhLXNjZW5lIGNhbGxiYWNrXG4gICAgICAvLyAod2hpY2ggaW5zZXJ0cyB0aGUgZGVmYXVsdHMsIGFuZCB0aGVyZWZvciBtYWtlcyB0d28gY2FtZXJhLCB3aGljaCBjb25mdXNlc1xuICAgICAgLy8gIHRoZSBUSFJFRS5qcyBzdWItc3lzdGVtKS4gTm90ZSByZXBsYWNlIG9ubHkgcmVwbGFjZXMgdGhlICpmaXJzdCogXG4gICAgICAvLyBhLXNjZW5lIG9mIHRoZSBzdHJpbmcsIHNvIHdpbGwgbm90IGVmZmVjdCBhbnkgcHJvcGVydGllcy5cbiAgICAgIHZhciB4bWwgPSAkKGRhdGEucmVwbGFjZShcImEtc2NlbmVcIixcIngtc2NlbmVcIikpO1xuICAgICAgLy8gUmVtb3ZlIHRoZSBjYW1lcmEsIGlmIHRoZXJlIGlzIGFuIChleHBsaWNpdCkgb25lLlxuICAgICAgLy8gVGhlIGNhbWVyYSBpcyBuZXZlciBkeW5hbWljYWxseSB1cGRhdGVkIChidXQgY29udHJvbGxlZCBieSB0aGUgaW4tYnJvd3NlciB0b29scylcbiAgICAgIHhtbC5maW5kKFwiYS1lbnRpdHlbY2FtZXJhXVwiKS5yZW1vdmUoKVxuXG4vLyAgICAgIGNvbnNvbGUubG9nKHhtbClcbiAgICAgIHhtbC5jaGlsZHJlbigpLnByZXBlbmRUbyhcImEtc2NlbmVcIik7XG4gIFxuICAgICAgZGVidWdfeG1sID0geG1sO1xuICAgICAgJChcImEtc2NlbmVcIikuYXR0cihcInZlcnNpb25cIix4bWwuYXR0cihcInZlcnNpb25cIikpICAvLyB1cGRhdGUgdGhlIHZlcnNpb24gbnVtYmVyXG4gICAgfVxuICAgIHNldFRpbWVvdXQobG9hZFNjZW5lLDEwMDApXG4gIH1cbiAgdmFyIHVwZGF0ZVNjZW5lID0gZnVuY3Rpb24oZCkge1xuLy8gICAgY29uc29sZS5sb2coXCJ1cGRhdGVTY2VuZVwiLGQpXG4gICAgaWYgKGQuY2hhbmdlICYmIGQuY2hhbmdlID09IFwiSEVBRFwiKSB7XG4gICAgICByZXR1cm4gbG9hZFNjZW5lKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvYWRTY2VuZShcIlJFTE9BRFwiKTtcbiAgICB9XG4gIH1cbiAgdmFyIGxvYWRTY2VuZSA9IGZ1bmN0aW9uKHR5KSB7XG4gICAgdmFyIHZlcnNpb24gPSAkKFwiYS1zY2VuZVwiKS5hdHRyKFwidmVyc2lvblwiKTtcbiAgICBpZiAodmVyc2lvbiA9PSB1bmRlZmluZWQgfHwgdHkgPT0gXCJSRUxPQURcIikge1xuICAgICAgLy8gZG8gdGhpcyB0aGUgc2xvdyB3YXlcbiAgICAgICQuZ2V0KCBcIi9zY2VuZVwiLCByZXNldFNjZW5lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY2hlY2sgZm9yIGNoYW5nZXNcbiAgICAgICQuZ2V0SlNPTiggXCIvc3RhdHVzL1wiICsgdmVyc2lvbiwgdXBkYXRlU2NlbmUpOyAgICAgICAgICBcbiAgICB9XG4gIH1cbiAgbG9hZFNjZW5lKFwiSEVBRFwiKVxufSk7XG5cbiovIl19
