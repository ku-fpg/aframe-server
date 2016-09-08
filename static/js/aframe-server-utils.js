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
      // (from aframe's inspector.js)
      this.onKeydown = this.onKeydown.bind(this);
      window.addEventListener('keydown', this.onKeydown);
      this.pushScene(); // And also push back the initial version of the scene to the shadow AFrame Object.
    } else {
      console.log("did not find edit");
    }
    this.loadScene("HEAD")    
  },
  onKeydown: function (evt) {
    // (from aframe's inspector.js)
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
      $.get( "/REST/scene", this.resetScene.bind(this));
    } else {
      // check for changes
      $.getJSON( "/REST/scene/" + version, this.updateScene.bind(this));          
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
        url: "/REST/scene",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9hZnJhbWUtc2VydmVyLXV0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKiBSZWxvYWQgdGhlIGFmcmFtZSBkeW5hbWljYWxseSwgYXMgbmVlZGVkLiBQdXQgdGhlIHNjZW5lIGJhY2sgdG8gdGhlIHNlcnZlciwgYXMgbmVlZGVkLlxuICovXG5cbmZ1bmN0aW9uIFNlcnZlclV0aWxzICgpIHtcblxuICAvLyAoRnJvbSBhZnJhbWUtZWRpdG9yKVxuICAvLyBEZXRlY3QgaWYgdGhlIHNjZW5lIGlzIGFscmVhZHkgbG9hZGVkXG4gIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnY29tcGxldGUnIHx8IGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkZWQnKSB7XG4gICAgdGhpcy5vbkRvbUxvYWRlZCgpO1xuICB9IGVsc2Uge1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCB0aGlzLm9uRG9tTG9hZGVkLmJpbmQodGhpcykpO1xuICB9XG59XG5cblNlcnZlclV0aWxzLnByb3RvdHlwZSA9IHtcblxuICBvbkRvbUxvYWRlZDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuc2NlbmVFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2Etc2NlbmUnKTtcbiAgICBpZiAodGhpcy5zY2VuZUVsLmhhc0xvYWRlZCkge1xuICAgICAgdGhpcy5vblNjZW5lTG9hZGVkKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2NlbmVFbC5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWQnLCB0aGlzLm9uU2NlbmVMb2FkZWQuYmluZCh0aGlzKSk7XG4gICAgfVxuICB9LFxuXG4gIG9uU2NlbmVMb2FkZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBFdmVyeXRoaW5nIGlzIHJlYWR5IHRvIGdvLlxuICAgIC8vIEZyb20gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy85Nzk5NzUvaG93LXRvLWdldC10aGUtdmFsdWUtZnJvbS10aGUtZ2V0LXBhcmFtZXRlcnNcbiAgICB2YXIgcGFyYW1zID0gd2luZG93LmxvY2F0aW9uLnNlYXJjaFxuICAgICAgLnN1YnN0cmluZygxKVxuICAgICAgLnNwbGl0KFwiJlwiKVxuICAgICAgLm1hcCh2ID0+IHYuc3BsaXQoXCI9XCIpKVxuICAgICAgLnJlZHVjZSgobWFwLCBba2V5LCB2YWx1ZV0pID0+IG1hcC5zZXQoa2V5LCBkZWNvZGVVUklDb21wb25lbnQodmFsdWUpKSwgbmV3IE1hcCgpKVxuICAgIGNvbnNvbGUubG9nKFwib25TY2VuZUxvYWRlZCAhXCIscGFyYW1zKTtcbiAgICAvLyBEbyB3ZSBuZWVkIHRvIHNlbmQgdGhlIGVkaXRlZCBTY2VuZSBiYWNrIHRvIHRoZSBzZXJ2ZXIgcGVyaW9kaWNhbGx5P1xuICAgIGlmIChwYXJhbXMuZ2V0KFwiZWRpdFwiKSAhPSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiZWRpdCBrZXkgKHMrY250bCthbHQpIGVuYWJsZWRcIik7XG4gICAgICAvLyAoZnJvbSBhZnJhbWUncyBpbnNwZWN0b3IuanMpXG4gICAgICB0aGlzLm9uS2V5ZG93biA9IHRoaXMub25LZXlkb3duLmJpbmQodGhpcyk7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMub25LZXlkb3duKTtcbiAgICAgIHRoaXMucHVzaFNjZW5lKCk7IC8vIEFuZCBhbHNvIHB1c2ggYmFjayB0aGUgaW5pdGlhbCB2ZXJzaW9uIG9mIHRoZSBzY2VuZSB0byB0aGUgc2hhZG93IEFGcmFtZSBPYmplY3QuXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiZGlkIG5vdCBmaW5kIGVkaXRcIik7XG4gICAgfVxuICAgIHRoaXMubG9hZFNjZW5lKFwiSEVBRFwiKSAgICBcbiAgfSxcbiAgb25LZXlkb3duOiBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgLy8gKGZyb20gYWZyYW1lJ3MgaW5zcGVjdG9yLmpzKVxuICAgIC8vIEFsdCArIEN0cmwgKyBzXG4gICAgY29uc29sZS5sb2coXCJvbktleWRvd25cIixldnQpXG4gICAgdmFyIHNob3J0Y3V0UHJlc3NlZCA9IGV2dC5rZXlDb2RlID09PSA4MyAmJiBldnQuY3RybEtleSAmJiBldnQuYWx0S2V5O1xuICAgIGlmICghc2hvcnRjdXRQcmVzc2VkKSB7IHJldHVybjsgfVxuICAgIHRoaXMucHVzaFNjZW5lKCk7XG4gIH0sXG4gIGxvYWRTY2VuZTogZnVuY3Rpb24odHkpIHtcbiAgICB2YXIgdmVyc2lvbiA9ICQoXCJhLXNjZW5lXCIpLmF0dHIoXCJ2ZXJzaW9uXCIpO1xuICAgIGlmICh2ZXJzaW9uID09IHVuZGVmaW5lZCB8fCB0eSA9PSBcIlJFTE9BRFwiKSB7XG4gICAgICAvLyBkbyB0aGlzIHRoZSBzbG93IHdheVxuICAgICAgJC5nZXQoIFwiL1JFU1Qvc2NlbmVcIiwgdGhpcy5yZXNldFNjZW5lLmJpbmQodGhpcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBjaGVjayBmb3IgY2hhbmdlc1xuICAgICAgJC5nZXRKU09OKCBcIi9SRVNUL3NjZW5lL1wiICsgdmVyc2lvbiwgdGhpcy51cGRhdGVTY2VuZS5iaW5kKHRoaXMpKTsgICAgICAgICAgXG4gICAgfVxuICB9LFxuICB1cGRhdGVTY2VuZTogZnVuY3Rpb24oZCkge1xuLy8gICAgY29uc29sZS5sb2coXCJ1cGRhdGVTY2VuZVwiLGQpXG4gICAgaWYgKGQuY2hhbmdlICYmIGQuY2hhbmdlID09IFwiSEVBRFwiKSB7XG4gICAgICB0aGlzLmxvYWRTY2VuZShcIkhFQURcIik7XG4gICAgfSBlbHNlIGlmIChkLmNoYW5nZSAmJiBkLmNoYW5nZSA9PSBcIkRFTFRBU1wiKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIkRFTFRBU1wiLGQpXG4gICAgICBkLmNoYW5nZXMuZm9yRWFjaChmdW5jdGlvbihvKSB7XG4gICAgICAgIHZhciBxID0gby5wYXRoWzBdO1xuICAgICAgICBmb3IgKHZhciBpID0gMTtpIDwgby5wYXRoLmxlbmd0aDtpKz0yKSB7XG4gICAgICAgICAgcSArPSBcIiA+IFwiICsgby5wYXRoW2krMV0gKyBcIjpudGgtb2YtdHlwZShcIiArIChvLnBhdGhbaV0rMSkgKyBcIilcIlxuICAgICAgICB9XG4gICAgICAgIC8vIFRoaXMgaXMgd2hlcmUgd2UgZG8gdGhlIG1pY3JvLXVwZGF0ZXNcbiAgICAgICAgJChxKS5hdHRyKG8uYXR0cixvLnZhbHVlKTtcbiAgICAgICAgY29uc29sZS5sb2cobyxxKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5sb2FkU2NlbmUoXCJIRUFEXCIpOyAgLy8gdHJ5IHJlbG9hZCB0aGUgc2NlbmVcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5sb2FkU2NlbmUoXCJSRUxPQURcIik7XG4gICAgfVxuICB9LFxuICByZXNldFNjZW5lOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgaWYgKCQoXCJhLXNjZW5lXCIpLmxlbmd0aCA9PSAwKSB7XG4gICAgICAvLyBOb3cgc2hvdWxkIG5ldmVyIGhhcHBlbixcbiAgICAgIC8vIGJ1dCBpZiBpdCBkb2VzLCBqdXN0IGxvYWQgdGhlIERPTSBkaXJlY3RseS5cbiAgICAgICQoXCJib2R5XCIpLnByZXBlbmQoZGF0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBjaCA9ICQoXCJhLXNjZW5lXCIpLmNoaWxkcmVuKCk7XG4gICAgICBmb3IoaSA9IDA7aSA8IGNoLmxlbmd0aDtpKyspIHtcbiAgICAgICAgaWYgKCFjaFtpXS5sb2NhbE5hbWVcbiAgICAgICAgICAgICAgfHwgY2hbaV0ubG9jYWxOYW1lID09IFwiY2FudmFzXCJcbiAgICAgICAgICAgICAgfHwgY2hbaV0ubG9jYWxOYW1lID09IFwiZGl2XCJcbiAgICAgICAgICAgICAgfHwgY2hbaV0ubG9jYWxOYW1lID09IFwiYS1jYW1lcmFcIiBcbiAgICAgICAgICAgICAgfHwgIWNoW2ldLmF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgfHwgKGNoW2ldLmxvY2FsTmFtZSA9PSBcImEtZW50aXR5XCIgXG4gICAgICAgICAgICAgICAgICAgJiYgKGNoW2ldLmF0dHJpYnV0ZXNbXCJjYW1lcmFcIl0gfHwgJChjaFtpXSkuZmluZChcImEtZW50aXR5W2NhbWVyYV1cIikubGVuZ3RoID4gMCB8fCAkKGNoW2ldKS5maW5kKFwiYS1jYW1lcmFcIikubGVuZ3RoID4gMCkpXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmF0dHJpYnV0ZXNbXCJkYXRhLWFmcmFtZS1kZWZhdWx0LWxpZ2h0XCJdXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmF0dHJpYnV0ZXNbXCJkYXRhLWFmcmFtZS1kZWZhdWx0LWNhbWVyYVwiXVxuICAgICAgICApIHtcbi8vICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImxlYXZpbmcgXCIgKyBpKTtcbiAgICAgICAgfSBlbHNlIHtcbi8vICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInJlbW92aW5nIFwiICsgaSlcbiAgICAgICAgICAvLyBUaGlzIGFwcGVhcnMgdG8gYmUgbGVhdmluZyB0aGUgVGhyZWUuanMgR2Vtb2V0cmllcyBiZWhpbmQuIFxuICAgICAgICAgIC8vIFRPRE86IGNoZWNrIGludG8gdGhpc1xuICAgICAgICAgICQoY2hbaV0pLnJlbW92ZSgpXG4gICAgICAgIH1cbiAgICAgIH1cbi8vICAgICAgICAgIGNvbnNvbGUubG9nKFwiY2hpbGRlcm5cIiwkKFwiYS1zY2VuZVwiKS5jaGlsZHJlbigpKVxuICAgICAgLy8gcmVwYWNlIGEtc2NlbmUgd2l0aCB4LXNjZW5lIHRvIGF2b2lkIHRyaWdnZXJpbmcgdGhlIGEtc2NlbmUgY2FsbGJhY2tcbiAgICAgIC8vICh3aGljaCBpbnNlcnRzIHRoZSBkZWZhdWx0cywgYW5kIHRoZXJlZm9yIG1ha2VzIHR3byBjYW1lcmEsIHdoaWNoIGNvbmZ1c2VzXG4gICAgICAvLyAgdGhlIFRIUkVFLmpzIHN1Yi1zeXN0ZW0pLiBOb3RlIHJlcGxhY2Ugb25seSByZXBsYWNlcyB0aGUgKmZpcnN0KiBcbiAgICAgIC8vIGEtc2NlbmUgb2YgdGhlIHN0cmluZywgc28gd2lsbCBub3QgZWZmZWN0IGFueSBwcm9wZXJ0aWVzLlxuICAgICAgdmFyIHhtbCA9ICQoZGF0YS5yZXBsYWNlKFwiYS1zY2VuZVwiLFwieC1zY2VuZVwiKSk7XG4gICAgICAvLyBSZW1vdmUgdGhlIGNhbWVyYSwgaWYgdGhlcmUgaXMgYW4gKGV4cGxpY2l0KSBvbmUuXG4gICAgICAvLyBUaGUgY2FtZXJhIGlzIG5ldmVyIGR5bmFtaWNhbGx5IHVwZGF0ZWQgKGJ1dCBjb250cm9sbGVkIGJ5IHRoZSBpbi1icm93c2VyIHRvb2xzKVxuICAgICAgeG1sLmZpbmQoXCJhLWVudGl0eVtjYW1lcmFdXCIpLnJlbW92ZSgpXG5cbi8vICAgICAgY29uc29sZS5sb2coeG1sKVxuICAgICAgeG1sLmNoaWxkcmVuKCkucHJlcGVuZFRvKFwiYS1zY2VuZVwiKTtcbiAgXG4gICAgICBkZWJ1Z194bWwgPSB4bWw7XG4gICAgICAkKFwiYS1zY2VuZVwiKS5hdHRyKFwidmVyc2lvblwiLHhtbC5hdHRyKFwidmVyc2lvblwiKSkgIC8vIHVwZGF0ZSB0aGUgdmVyc2lvbiBudW1iZXJcbiAgICB9XG4gICAgdGhpcy5sb2FkU2NlbmUoXCJIRUFEXCIpO1xuICB9LFxuICBwdXNoU2NlbmU6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnNvbGUubG9nKFwicHVzaFNjZW5lXCIpXG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgICQuYWpheChcbiAgICAgIHsgdHlwZTogXCJQVVRcIixcbiAgICAgICAgdXJsOiBcIi9SRVNUL3NjZW5lXCIsXG4gICAgICAgIGRhdGE6IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdib2R5JylbMF0uaW5uZXJIVE1MLFxuICAgICAgICBjb250ZW50VHlwZTogICd0ZXh0L3BsYWluOyBjaGFyc2V0PVVURi04JyxcbiAgICAgICAgZGF0YVR5cGU6IFwianNvblwiLCAgICAgLy8gcmVzdWx0IHR5cGVcbiAgICAgICAgY2FjaGU6IGZhbHNlLFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oKSB7XG4vLyAgICAgICAgICBjb25zb2xlLmxvZyhcIkZhaWxlZCB0byBzZW5kIERPTTsgcmV0cnlpbmdcIik7XG4gICAgICAgIH0sXG4gICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uKHhtbCkge1xuLy8gICAgICAgICAgICAgYWxlcnQoXCJpdCB3b3Jrc1wiKTtcbi8vICAgICAgICAgICBhbGVydCgkKHhtbCkuZmluZChcInByb2plY3RcIilbMF0uYXR0cihcImlkXCIpKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBjb25zb2xlLmxvZyhcInB1c2hTY2VuZSAuLi5cIik7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IFNlcnZlclV0aWxzKCk7XG5cbi8qXG4kKGZ1bmN0aW9uKCl7XG4gIFxuICAvLyBFdmVyeSBzZWNvbmQsIHVwZGF0ZSB0aGUgc2NlbmVcbiAgdmFyIHNjZW5lVGV4dCA9IFwiXCI7XG4gIHZhciByZXNldFNjZW5lID0gZnVuY3Rpb24oZGF0YSkge1xuLy8gICAgICAgIGNvbnNvbGUubG9nKFwiY2hlY2tpbmdcIilcbiAgICBpZiAoZGF0YSA9PSBzY2VuZVRleHQpIHtcbiAgICAgICAgc2V0VGltZW91dChsb2FkU2NlbmUsMTAwMClcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzY2VuZVRleHQgPSBkYXRhO1xuICAgIHggPSBzY2VuZVRleHQ7XG4gICAgXG4gICAgaWYgKCQoXCJhLXNjZW5lXCIpLmxlbmd0aCA9PSAwKSB7XG4gICAgICAvLyBOb3cgc2hvdWxkIG5ldmVyIGhhcHBlblxuICAgICAgJChcImJvZHlcIikucHJlcGVuZChkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGNoID0gJChcImEtc2NlbmVcIikuY2hpbGRyZW4oKTtcbiAgICAgIGZvcihpID0gMDtpIDwgY2gubGVuZ3RoO2krKykge1xuICAgICAgICBpZiAoIWNoW2ldLmxvY2FsTmFtZVxuICAgICAgICAgICAgICB8fCBjaFtpXS5sb2NhbE5hbWUgPT0gXCJjYW52YXNcIlxuICAgICAgICAgICAgICB8fCBjaFtpXS5sb2NhbE5hbWUgPT0gXCJkaXZcIlxuICAgICAgICAgICAgICB8fCBjaFtpXS5sb2NhbE5hbWUgPT0gXCJhLWNhbWVyYVwiIFxuICAgICAgICAgICAgICB8fCAhY2hbaV0uYXR0cmlidXRlc1xuICAgICAgICAgICAgICB8fCAoY2hbaV0ubG9jYWxOYW1lID09IFwiYS1lbnRpdHlcIiBcbiAgICAgICAgICAgICAgICAgICAmJiAoY2hbaV0uYXR0cmlidXRlc1tcImNhbWVyYVwiXSB8fCAkKGNoW2ldKS5maW5kKFwiYS1lbnRpdHlbY2FtZXJhXVwiKS5sZW5ndGggPiAwIHx8ICQoY2hbaV0pLmZpbmQoXCJhLWNhbWVyYVwiKS5sZW5ndGggPiAwKSlcbiAgICAgICAgICAgICAgfHwgY2hbaV0uYXR0cmlidXRlc1tcImRhdGEtYWZyYW1lLWRlZmF1bHQtbGlnaHRcIl1cbiAgICAgICAgICAgICAgfHwgY2hbaV0uYXR0cmlidXRlc1tcImRhdGEtYWZyYW1lLWRlZmF1bHQtY2FtZXJhXCJdXG4gICAgICAgICkge1xuLy8gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibGVhdmluZyBcIiArIGkpO1xuICAgICAgICB9IGVsc2Uge1xuLy8gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwicmVtb3ZpbmcgXCIgKyBpKVxuICAgICAgICAgIC8vIFRoaXMgYXBwZWFycyB0byBiZSBsZWF2aW5nIHRoZSBUaHJlZS5qcyBHZW1vZXRyaWVzIGJlaGluZC4gXG4gICAgICAgICAgLy8gVE9ETzogY2hlY2sgaW50byB0aGlzXG4gICAgICAgICAgJChjaFtpXSkucmVtb3ZlKClcbiAgICAgICAgfVxuICAgICAgfVxuLy8gICAgICAgICAgY29uc29sZS5sb2coXCJjaGlsZGVyblwiLCQoXCJhLXNjZW5lXCIpLmNoaWxkcmVuKCkpXG4gICAgICAvLyByZXBhY2UgYS1zY2VuZSB3aXRoIHgtc2NlbmUgdG8gYXZvaWQgdHJpZ2dlcmluZyB0aGUgYS1zY2VuZSBjYWxsYmFja1xuICAgICAgLy8gKHdoaWNoIGluc2VydHMgdGhlIGRlZmF1bHRzLCBhbmQgdGhlcmVmb3IgbWFrZXMgdHdvIGNhbWVyYSwgd2hpY2ggY29uZnVzZXNcbiAgICAgIC8vICB0aGUgVEhSRUUuanMgc3ViLXN5c3RlbSkuIE5vdGUgcmVwbGFjZSBvbmx5IHJlcGxhY2VzIHRoZSAqZmlyc3QqIFxuICAgICAgLy8gYS1zY2VuZSBvZiB0aGUgc3RyaW5nLCBzbyB3aWxsIG5vdCBlZmZlY3QgYW55IHByb3BlcnRpZXMuXG4gICAgICB2YXIgeG1sID0gJChkYXRhLnJlcGxhY2UoXCJhLXNjZW5lXCIsXCJ4LXNjZW5lXCIpKTtcbiAgICAgIC8vIFJlbW92ZSB0aGUgY2FtZXJhLCBpZiB0aGVyZSBpcyBhbiAoZXhwbGljaXQpIG9uZS5cbiAgICAgIC8vIFRoZSBjYW1lcmEgaXMgbmV2ZXIgZHluYW1pY2FsbHkgdXBkYXRlZCAoYnV0IGNvbnRyb2xsZWQgYnkgdGhlIGluLWJyb3dzZXIgdG9vbHMpXG4gICAgICB4bWwuZmluZChcImEtZW50aXR5W2NhbWVyYV1cIikucmVtb3ZlKClcblxuLy8gICAgICBjb25zb2xlLmxvZyh4bWwpXG4gICAgICB4bWwuY2hpbGRyZW4oKS5wcmVwZW5kVG8oXCJhLXNjZW5lXCIpO1xuICBcbiAgICAgIGRlYnVnX3htbCA9IHhtbDtcbiAgICAgICQoXCJhLXNjZW5lXCIpLmF0dHIoXCJ2ZXJzaW9uXCIseG1sLmF0dHIoXCJ2ZXJzaW9uXCIpKSAgLy8gdXBkYXRlIHRoZSB2ZXJzaW9uIG51bWJlclxuICAgIH1cbiAgICBzZXRUaW1lb3V0KGxvYWRTY2VuZSwxMDAwKVxuICB9XG4gIHZhciB1cGRhdGVTY2VuZSA9IGZ1bmN0aW9uKGQpIHtcbi8vICAgIGNvbnNvbGUubG9nKFwidXBkYXRlU2NlbmVcIixkKVxuICAgIGlmIChkLmNoYW5nZSAmJiBkLmNoYW5nZSA9PSBcIkhFQURcIikge1xuICAgICAgcmV0dXJuIGxvYWRTY2VuZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2FkU2NlbmUoXCJSRUxPQURcIik7XG4gICAgfVxuICB9XG4gIHZhciBsb2FkU2NlbmUgPSBmdW5jdGlvbih0eSkge1xuICAgIHZhciB2ZXJzaW9uID0gJChcImEtc2NlbmVcIikuYXR0cihcInZlcnNpb25cIik7XG4gICAgaWYgKHZlcnNpb24gPT0gdW5kZWZpbmVkIHx8IHR5ID09IFwiUkVMT0FEXCIpIHtcbiAgICAgIC8vIGRvIHRoaXMgdGhlIHNsb3cgd2F5XG4gICAgICAkLmdldCggXCIvc2NlbmVcIiwgcmVzZXRTY2VuZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNoZWNrIGZvciBjaGFuZ2VzXG4gICAgICAkLmdldEpTT04oIFwiL3N0YXR1cy9cIiArIHZlcnNpb24sIHVwZGF0ZVNjZW5lKTsgICAgICAgICAgXG4gICAgfVxuICB9XG4gIGxvYWRTY2VuZShcIkhFQURcIilcbn0pO1xuXG4qLyJdfQ==
