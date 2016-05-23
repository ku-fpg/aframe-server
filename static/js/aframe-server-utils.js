(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.aframeServerUtils = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9hZnJhbWUtc2VydmVyLXV0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKiBSZWxvYWQgdGhlIGFmcmFtZSBkeW5hbWljYWxseSwgYXMgbmVlZGVkXG4gKi9cblxuZnVuY3Rpb24gU2VydmVyVXRpbHMgKCkge1xuXG4gIC8vIChGcm9tIGFmcmFtZS1lZGl0b3IpXG4gIC8vIERldGVjdCBpZiB0aGUgc2NlbmUgaXMgYWxyZWFkeSBsb2FkZWRcbiAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdjb21wbGV0ZScgfHwgZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRlZCcpIHtcbiAgICB0aGlzLm9uRG9tTG9hZGVkKCk7XG4gIH0gZWxzZSB7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIHRoaXMub25Eb21Mb2FkZWQuYmluZCh0aGlzKSk7XG4gIH1cbn1cblxuU2VydmVyVXRpbHMucHJvdG90eXBlID0ge1xuXG4gIG9uRG9tTG9hZGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5zY2VuZUVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYS1zY2VuZScpO1xuICAgIGlmICh0aGlzLnNjZW5lRWwuaGFzTG9hZGVkKSB7XG4gICAgICB0aGlzLm9uU2NlbmVMb2FkZWQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zY2VuZUVsLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZCcsIHRoaXMub25TY2VuZUxvYWRlZC5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH0sXG5cbiAgb25TY2VuZUxvYWRlZDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMubG9hZFNjZW5lKFwiSEVBRFwiKVxuICB9LFxuICBsb2FkU2NlbmU6IGZ1bmN0aW9uKHR5KSB7XG4gICAgdmFyIHZlcnNpb24gPSAkKFwiYS1zY2VuZVwiKS5hdHRyKFwidmVyc2lvblwiKTtcbiAgICBpZiAodmVyc2lvbiA9PSB1bmRlZmluZWQgfHwgdHkgPT0gXCJSRUxPQURcIikge1xuICAgICAgLy8gZG8gdGhpcyB0aGUgc2xvdyB3YXlcbiAgICAgICQuZ2V0KCBcIi9zY2VuZVwiLCB0aGlzLnJlc2V0U2NlbmUuYmluZCh0aGlzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNoZWNrIGZvciBjaGFuZ2VzXG4gICAgICAkLmdldEpTT04oIFwiL3N0YXR1cy9cIiArIHZlcnNpb24sIHRoaXMudXBkYXRlU2NlbmUuYmluZCh0aGlzKSk7ICAgICAgICAgIFxuICAgIH1cbiAgfSxcbiAgdXBkYXRlU2NlbmU6IGZ1bmN0aW9uKGQpIHtcbi8vICAgIGNvbnNvbGUubG9nKFwidXBkYXRlU2NlbmVcIixkKVxuICAgIGlmIChkLmNoYW5nZSAmJiBkLmNoYW5nZSA9PSBcIkhFQURcIikge1xuICAgICAgdGhpcy5sb2FkU2NlbmUoXCJIRUFEXCIpO1xuICAgIH0gZWxzZSBpZiAoZC5jaGFuZ2UgJiYgZC5jaGFuZ2UgPT0gXCJERUxUQVNcIikge1xuICAgICAgY29uc29sZS5sb2coXCJERUxUQVNcIixkKVxuICAgICAgZC5jaGFuZ2VzLmZvckVhY2goZnVuY3Rpb24obykge1xuICAgICAgICB2YXIgcSA9IG8ucGF0aFswXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7aSA8IG8ucGF0aC5sZW5ndGg7aSs9Mikge1xuICAgICAgICAgIHEgKz0gXCIgPiBcIiArIG8ucGF0aFtpKzFdICsgXCI6bnRoLW9mLXR5cGUoXCIgKyAoby5wYXRoW2ldKzEpICsgXCIpXCJcbiAgICAgICAgfVxuICAgICAgICAvLyBUaGlzIGlzIHdoZXJlIHdlIGRvIHRoZSBtaWNyby11cGRhdGVzXG4gICAgICAgICQocSkuYXR0cihvLmF0dHIsby52YWx1ZSk7XG4gICAgICAgIGNvbnNvbGUubG9nKG8scSk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMubG9hZFNjZW5lKFwiSEVBRFwiKTsgIC8vIHRyeSByZWxvYWQgdGhlIHNjZW5lXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubG9hZFNjZW5lKFwiUkVMT0FEXCIpO1xuICAgIH1cbiAgfSxcbiAgcmVzZXRTY2VuZTogZnVuY3Rpb24oZGF0YSkge1xuICAgIGlmICgkKFwiYS1zY2VuZVwiKS5sZW5ndGggPT0gMCkge1xuICAgICAgLy8gTm93IHNob3VsZCBuZXZlciBoYXBwZW4sXG4gICAgICAvLyBidXQgaWYgaXQgZG9lcywganVzdCBsb2FkIHRoZSBET00gZGlyZWN0bHkuXG4gICAgICAkKFwiYm9keVwiKS5wcmVwZW5kKGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY2ggPSAkKFwiYS1zY2VuZVwiKS5jaGlsZHJlbigpO1xuICAgICAgZm9yKGkgPSAwO2kgPCBjaC5sZW5ndGg7aSsrKSB7XG4gICAgICAgIGlmICghY2hbaV0ubG9jYWxOYW1lXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImNhbnZhc1wiXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImRpdlwiXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImEtY2FtZXJhXCIgXG4gICAgICAgICAgICAgIHx8ICFjaFtpXS5hdHRyaWJ1dGVzXG4gICAgICAgICAgICAgIHx8IChjaFtpXS5sb2NhbE5hbWUgPT0gXCJhLWVudGl0eVwiIFxuICAgICAgICAgICAgICAgICAgICYmIChjaFtpXS5hdHRyaWJ1dGVzW1wiY2FtZXJhXCJdIHx8ICQoY2hbaV0pLmZpbmQoXCJhLWVudGl0eVtjYW1lcmFdXCIpLmxlbmd0aCA+IDAgfHwgJChjaFtpXSkuZmluZChcImEtY2FtZXJhXCIpLmxlbmd0aCA+IDApKVxuICAgICAgICAgICAgICB8fCBjaFtpXS5hdHRyaWJ1dGVzW1wiZGF0YS1hZnJhbWUtZGVmYXVsdC1saWdodFwiXVxuICAgICAgICAgICAgICB8fCBjaFtpXS5hdHRyaWJ1dGVzW1wiZGF0YS1hZnJhbWUtZGVmYXVsdC1jYW1lcmFcIl1cbiAgICAgICAgKSB7XG4vLyAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJsZWF2aW5nIFwiICsgaSk7XG4gICAgICAgIH0gZWxzZSB7XG4vLyAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJyZW1vdmluZyBcIiArIGkpXG4gICAgICAgICAgLy8gVGhpcyBhcHBlYXJzIHRvIGJlIGxlYXZpbmcgdGhlIFRocmVlLmpzIEdlbW9ldHJpZXMgYmVoaW5kLiBcbiAgICAgICAgICAvLyBUT0RPOiBjaGVjayBpbnRvIHRoaXNcbiAgICAgICAgICAkKGNoW2ldKS5yZW1vdmUoKVxuICAgICAgICB9XG4gICAgICB9XG4vLyAgICAgICAgICBjb25zb2xlLmxvZyhcImNoaWxkZXJuXCIsJChcImEtc2NlbmVcIikuY2hpbGRyZW4oKSlcbiAgICAgIC8vIHJlcGFjZSBhLXNjZW5lIHdpdGggeC1zY2VuZSB0byBhdm9pZCB0cmlnZ2VyaW5nIHRoZSBhLXNjZW5lIGNhbGxiYWNrXG4gICAgICAvLyAod2hpY2ggaW5zZXJ0cyB0aGUgZGVmYXVsdHMsIGFuZCB0aGVyZWZvciBtYWtlcyB0d28gY2FtZXJhLCB3aGljaCBjb25mdXNlc1xuICAgICAgLy8gIHRoZSBUSFJFRS5qcyBzdWItc3lzdGVtKS4gTm90ZSByZXBsYWNlIG9ubHkgcmVwbGFjZXMgdGhlICpmaXJzdCogXG4gICAgICAvLyBhLXNjZW5lIG9mIHRoZSBzdHJpbmcsIHNvIHdpbGwgbm90IGVmZmVjdCBhbnkgcHJvcGVydGllcy5cbiAgICAgIHZhciB4bWwgPSAkKGRhdGEucmVwbGFjZShcImEtc2NlbmVcIixcIngtc2NlbmVcIikpO1xuICAgICAgLy8gUmVtb3ZlIHRoZSBjYW1lcmEsIGlmIHRoZXJlIGlzIGFuIChleHBsaWNpdCkgb25lLlxuICAgICAgLy8gVGhlIGNhbWVyYSBpcyBuZXZlciBkeW5hbWljYWxseSB1cGRhdGVkIChidXQgY29udHJvbGxlZCBieSB0aGUgaW4tYnJvd3NlciB0b29scylcbiAgICAgIHhtbC5maW5kKFwiYS1lbnRpdHlbY2FtZXJhXVwiKS5yZW1vdmUoKVxuXG4vLyAgICAgIGNvbnNvbGUubG9nKHhtbClcbiAgICAgIHhtbC5jaGlsZHJlbigpLnByZXBlbmRUbyhcImEtc2NlbmVcIik7XG4gIFxuICAgICAgZGVidWdfeG1sID0geG1sO1xuICAgICAgJChcImEtc2NlbmVcIikuYXR0cihcInZlcnNpb25cIix4bWwuYXR0cihcInZlcnNpb25cIikpICAvLyB1cGRhdGUgdGhlIHZlcnNpb24gbnVtYmVyXG4gICAgfVxuICAgIHRoaXMubG9hZFNjZW5lKFwiSEVBRFwiKTtcbiAgfVxuICBcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IFNlcnZlclV0aWxzKCk7XG5cbi8qXG4kKGZ1bmN0aW9uKCl7XG4gIFxuICAvLyBFdmVyeSBzZWNvbmQsIHVwZGF0ZSB0aGUgc2NlbmVcbiAgdmFyIHNjZW5lVGV4dCA9IFwiXCI7XG4gIHZhciByZXNldFNjZW5lID0gZnVuY3Rpb24oZGF0YSkge1xuLy8gICAgICAgIGNvbnNvbGUubG9nKFwiY2hlY2tpbmdcIilcbiAgICBpZiAoZGF0YSA9PSBzY2VuZVRleHQpIHtcbiAgICAgICAgc2V0VGltZW91dChsb2FkU2NlbmUsMTAwMClcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzY2VuZVRleHQgPSBkYXRhO1xuICAgIHggPSBzY2VuZVRleHQ7XG4gICAgXG4gICAgaWYgKCQoXCJhLXNjZW5lXCIpLmxlbmd0aCA9PSAwKSB7XG4gICAgICAvLyBOb3cgc2hvdWxkIG5ldmVyIGhhcHBlblxuICAgICAgJChcImJvZHlcIikucHJlcGVuZChkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGNoID0gJChcImEtc2NlbmVcIikuY2hpbGRyZW4oKTtcbiAgICAgIGZvcihpID0gMDtpIDwgY2gubGVuZ3RoO2krKykge1xuICAgICAgICBpZiAoIWNoW2ldLmxvY2FsTmFtZVxuICAgICAgICAgICAgICB8fCBjaFtpXS5sb2NhbE5hbWUgPT0gXCJjYW52YXNcIlxuICAgICAgICAgICAgICB8fCBjaFtpXS5sb2NhbE5hbWUgPT0gXCJkaXZcIlxuICAgICAgICAgICAgICB8fCBjaFtpXS5sb2NhbE5hbWUgPT0gXCJhLWNhbWVyYVwiIFxuICAgICAgICAgICAgICB8fCAhY2hbaV0uYXR0cmlidXRlc1xuICAgICAgICAgICAgICB8fCAoY2hbaV0ubG9jYWxOYW1lID09IFwiYS1lbnRpdHlcIiBcbiAgICAgICAgICAgICAgICAgICAmJiAoY2hbaV0uYXR0cmlidXRlc1tcImNhbWVyYVwiXSB8fCAkKGNoW2ldKS5maW5kKFwiYS1lbnRpdHlbY2FtZXJhXVwiKS5sZW5ndGggPiAwIHx8ICQoY2hbaV0pLmZpbmQoXCJhLWNhbWVyYVwiKS5sZW5ndGggPiAwKSlcbiAgICAgICAgICAgICAgfHwgY2hbaV0uYXR0cmlidXRlc1tcImRhdGEtYWZyYW1lLWRlZmF1bHQtbGlnaHRcIl1cbiAgICAgICAgICAgICAgfHwgY2hbaV0uYXR0cmlidXRlc1tcImRhdGEtYWZyYW1lLWRlZmF1bHQtY2FtZXJhXCJdXG4gICAgICAgICkge1xuLy8gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibGVhdmluZyBcIiArIGkpO1xuICAgICAgICB9IGVsc2Uge1xuLy8gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwicmVtb3ZpbmcgXCIgKyBpKVxuICAgICAgICAgIC8vIFRoaXMgYXBwZWFycyB0byBiZSBsZWF2aW5nIHRoZSBUaHJlZS5qcyBHZW1vZXRyaWVzIGJlaGluZC4gXG4gICAgICAgICAgLy8gVE9ETzogY2hlY2sgaW50byB0aGlzXG4gICAgICAgICAgJChjaFtpXSkucmVtb3ZlKClcbiAgICAgICAgfVxuICAgICAgfVxuLy8gICAgICAgICAgY29uc29sZS5sb2coXCJjaGlsZGVyblwiLCQoXCJhLXNjZW5lXCIpLmNoaWxkcmVuKCkpXG4gICAgICAvLyByZXBhY2UgYS1zY2VuZSB3aXRoIHgtc2NlbmUgdG8gYXZvaWQgdHJpZ2dlcmluZyB0aGUgYS1zY2VuZSBjYWxsYmFja1xuICAgICAgLy8gKHdoaWNoIGluc2VydHMgdGhlIGRlZmF1bHRzLCBhbmQgdGhlcmVmb3IgbWFrZXMgdHdvIGNhbWVyYSwgd2hpY2ggY29uZnVzZXNcbiAgICAgIC8vICB0aGUgVEhSRUUuanMgc3ViLXN5c3RlbSkuIE5vdGUgcmVwbGFjZSBvbmx5IHJlcGxhY2VzIHRoZSAqZmlyc3QqIFxuICAgICAgLy8gYS1zY2VuZSBvZiB0aGUgc3RyaW5nLCBzbyB3aWxsIG5vdCBlZmZlY3QgYW55IHByb3BlcnRpZXMuXG4gICAgICB2YXIgeG1sID0gJChkYXRhLnJlcGxhY2UoXCJhLXNjZW5lXCIsXCJ4LXNjZW5lXCIpKTtcbiAgICAgIC8vIFJlbW92ZSB0aGUgY2FtZXJhLCBpZiB0aGVyZSBpcyBhbiAoZXhwbGljaXQpIG9uZS5cbiAgICAgIC8vIFRoZSBjYW1lcmEgaXMgbmV2ZXIgZHluYW1pY2FsbHkgdXBkYXRlZCAoYnV0IGNvbnRyb2xsZWQgYnkgdGhlIGluLWJyb3dzZXIgdG9vbHMpXG4gICAgICB4bWwuZmluZChcImEtZW50aXR5W2NhbWVyYV1cIikucmVtb3ZlKClcblxuLy8gICAgICBjb25zb2xlLmxvZyh4bWwpXG4gICAgICB4bWwuY2hpbGRyZW4oKS5wcmVwZW5kVG8oXCJhLXNjZW5lXCIpO1xuICBcbiAgICAgIGRlYnVnX3htbCA9IHhtbDtcbiAgICAgICQoXCJhLXNjZW5lXCIpLmF0dHIoXCJ2ZXJzaW9uXCIseG1sLmF0dHIoXCJ2ZXJzaW9uXCIpKSAgLy8gdXBkYXRlIHRoZSB2ZXJzaW9uIG51bWJlclxuICAgIH1cbiAgICBzZXRUaW1lb3V0KGxvYWRTY2VuZSwxMDAwKVxuICB9XG4gIHZhciB1cGRhdGVTY2VuZSA9IGZ1bmN0aW9uKGQpIHtcbi8vICAgIGNvbnNvbGUubG9nKFwidXBkYXRlU2NlbmVcIixkKVxuICAgIGlmIChkLmNoYW5nZSAmJiBkLmNoYW5nZSA9PSBcIkhFQURcIikge1xuICAgICAgcmV0dXJuIGxvYWRTY2VuZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2FkU2NlbmUoXCJSRUxPQURcIik7XG4gICAgfVxuICB9XG4gIHZhciBsb2FkU2NlbmUgPSBmdW5jdGlvbih0eSkge1xuICAgIHZhciB2ZXJzaW9uID0gJChcImEtc2NlbmVcIikuYXR0cihcInZlcnNpb25cIik7XG4gICAgaWYgKHZlcnNpb24gPT0gdW5kZWZpbmVkIHx8IHR5ID09IFwiUkVMT0FEXCIpIHtcbiAgICAgIC8vIGRvIHRoaXMgdGhlIHNsb3cgd2F5XG4gICAgICAkLmdldCggXCIvc2NlbmVcIiwgcmVzZXRTY2VuZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNoZWNrIGZvciBjaGFuZ2VzXG4gICAgICAkLmdldEpTT04oIFwiL3N0YXR1cy9cIiArIHZlcnNpb24sIHVwZGF0ZVNjZW5lKTsgICAgICAgICAgXG4gICAgfVxuICB9XG4gIGxvYWRTY2VuZShcIkhFQURcIilcbn0pO1xuXG4qLyJdfQ==
