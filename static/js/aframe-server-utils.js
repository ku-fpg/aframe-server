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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9hZnJhbWUtc2VydmVyLXV0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKiBSZWxvYWQgdGhlIGFmcmFtZSBkeW5hbWljYWxseSwgYXMgbmVlZGVkXG4gKi9cblxuZnVuY3Rpb24gU2VydmVyVXRpbHMgKCkge1xuXG4gIC8vIChGcm9tIGFmcmFtZS1lZGl0b3IpXG4gIC8vIERldGVjdCBpZiB0aGUgc2NlbmUgaXMgYWxyZWFkeSBsb2FkZWRcbiAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdjb21wbGV0ZScgfHwgZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRlZCcpIHtcbiAgICB0aGlzLm9uRG9tTG9hZGVkKCk7XG4gIH0gZWxzZSB7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIHRoaXMub25Eb21Mb2FkZWQuYmluZCh0aGlzKSk7XG4gIH1cbn1cblxuU2VydmVyVXRpbHMucHJvdG90eXBlID0ge1xuXG4gIG9uRG9tTG9hZGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5zY2VuZUVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYS1zY2VuZScpO1xuICAgIGlmICh0aGlzLnNjZW5lRWwuaGFzTG9hZGVkKSB7XG4gICAgICB0aGlzLm9uU2NlbmVMb2FkZWQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zY2VuZUVsLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZCcsIHRoaXMub25TY2VuZUxvYWRlZC5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH0sXG5cbiAgb25TY2VuZUxvYWRlZDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMubG9hZFNjZW5lKFwiSEVBRFwiKVxuICB9LFxuICBsb2FkU2NlbmU6IGZ1bmN0aW9uKHR5KSB7XG4gICAgdmFyIHZlcnNpb24gPSAkKFwiYS1zY2VuZVwiKS5hdHRyKFwidmVyc2lvblwiKTtcbiAgICBpZiAodmVyc2lvbiA9PSB1bmRlZmluZWQgfHwgdHkgPT0gXCJSRUxPQURcIikge1xuICAgICAgLy8gZG8gdGhpcyB0aGUgc2xvdyB3YXlcbiAgICAgICQuZ2V0KCBcIi9zY2VuZVwiLCB0aGlzLnJlc2V0U2NlbmUuYmluZCh0aGlzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNoZWNrIGZvciBjaGFuZ2VzXG4gICAgICAkLmdldEpTT04oIFwiL3N0YXR1cy9cIiArIHZlcnNpb24sIHRoaXMudXBkYXRlU2NlbmUuYmluZCh0aGlzKSk7ICAgICAgICAgIFxuICAgIH1cbiAgfSxcbiAgdXBkYXRlU2NlbmU6IGZ1bmN0aW9uKGQpIHtcbi8vICAgIGNvbnNvbGUubG9nKFwidXBkYXRlU2NlbmVcIixkKVxuICAgIGlmIChkLmNoYW5nZSAmJiBkLmNoYW5nZSA9PSBcIkhFQURcIikge1xuICAgICAgdGhpcy5sb2FkU2NlbmUoXCJIRUFEXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxvYWRTY2VuZShcIlJFTE9BRFwiKTtcbiAgICB9XG4gIH0sXG4gIHJlc2V0U2NlbmU6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBpZiAoJChcImEtc2NlbmVcIikubGVuZ3RoID09IDApIHtcbiAgICAgIC8vIE5vdyBzaG91bGQgbmV2ZXIgaGFwcGVuLFxuICAgICAgLy8gYnV0IGlmIGl0IGRvZXMsIGp1c3QgbG9hZCB0aGUgRE9NIGRpcmVjdGx5LlxuICAgICAgJChcImJvZHlcIikucHJlcGVuZChkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGNoID0gJChcImEtc2NlbmVcIikuY2hpbGRyZW4oKTtcbiAgICAgIGZvcihpID0gMDtpIDwgY2gubGVuZ3RoO2krKykge1xuICAgICAgICBpZiAoIWNoW2ldLmxvY2FsTmFtZVxuICAgICAgICAgICAgICB8fCBjaFtpXS5sb2NhbE5hbWUgPT0gXCJjYW52YXNcIlxuICAgICAgICAgICAgICB8fCBjaFtpXS5sb2NhbE5hbWUgPT0gXCJkaXZcIlxuICAgICAgICAgICAgICB8fCBjaFtpXS5sb2NhbE5hbWUgPT0gXCJhLWNhbWVyYVwiIFxuICAgICAgICAgICAgICB8fCAhY2hbaV0uYXR0cmlidXRlc1xuICAgICAgICAgICAgICB8fCAoY2hbaV0ubG9jYWxOYW1lID09IFwiYS1lbnRpdHlcIiBcbiAgICAgICAgICAgICAgICAgICAmJiAoY2hbaV0uYXR0cmlidXRlc1tcImNhbWVyYVwiXSB8fCAkKGNoW2ldKS5maW5kKFwiYS1lbnRpdHlbY2FtZXJhXVwiKS5sZW5ndGggPiAwIHx8ICQoY2hbaV0pLmZpbmQoXCJhLWNhbWVyYVwiKS5sZW5ndGggPiAwKSlcbiAgICAgICAgICAgICAgfHwgY2hbaV0uYXR0cmlidXRlc1tcImRhdGEtYWZyYW1lLWRlZmF1bHQtbGlnaHRcIl1cbiAgICAgICAgICAgICAgfHwgY2hbaV0uYXR0cmlidXRlc1tcImRhdGEtYWZyYW1lLWRlZmF1bHQtY2FtZXJhXCJdXG4gICAgICAgICkge1xuLy8gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibGVhdmluZyBcIiArIGkpO1xuICAgICAgICB9IGVsc2Uge1xuLy8gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwicmVtb3ZpbmcgXCIgKyBpKVxuICAgICAgICAgIC8vIFRoaXMgYXBwZWFycyB0byBiZSBsZWF2aW5nIHRoZSBUaHJlZS5qcyBHZW1vZXRyaWVzIGJlaGluZC4gXG4gICAgICAgICAgLy8gVE9ETzogY2hlY2sgaW50byB0aGlzXG4gICAgICAgICAgJChjaFtpXSkucmVtb3ZlKClcbiAgICAgICAgfVxuICAgICAgfVxuLy8gICAgICAgICAgY29uc29sZS5sb2coXCJjaGlsZGVyblwiLCQoXCJhLXNjZW5lXCIpLmNoaWxkcmVuKCkpXG4gICAgICAvLyByZXBhY2UgYS1zY2VuZSB3aXRoIHgtc2NlbmUgdG8gYXZvaWQgdHJpZ2dlcmluZyB0aGUgYS1zY2VuZSBjYWxsYmFja1xuICAgICAgLy8gKHdoaWNoIGluc2VydHMgdGhlIGRlZmF1bHRzLCBhbmQgdGhlcmVmb3IgbWFrZXMgdHdvIGNhbWVyYSwgd2hpY2ggY29uZnVzZXNcbiAgICAgIC8vICB0aGUgVEhSRUUuanMgc3ViLXN5c3RlbSkuIE5vdGUgcmVwbGFjZSBvbmx5IHJlcGxhY2VzIHRoZSAqZmlyc3QqIFxuICAgICAgLy8gYS1zY2VuZSBvZiB0aGUgc3RyaW5nLCBzbyB3aWxsIG5vdCBlZmZlY3QgYW55IHByb3BlcnRpZXMuXG4gICAgICB2YXIgeG1sID0gJChkYXRhLnJlcGxhY2UoXCJhLXNjZW5lXCIsXCJ4LXNjZW5lXCIpKTtcbiAgICAgIC8vIFJlbW92ZSB0aGUgY2FtZXJhLCBpZiB0aGVyZSBpcyBhbiAoZXhwbGljaXQpIG9uZS5cbiAgICAgIC8vIFRoZSBjYW1lcmEgaXMgbmV2ZXIgZHluYW1pY2FsbHkgdXBkYXRlZCAoYnV0IGNvbnRyb2xsZWQgYnkgdGhlIGluLWJyb3dzZXIgdG9vbHMpXG4gICAgICB4bWwuZmluZChcImEtZW50aXR5W2NhbWVyYV1cIikucmVtb3ZlKClcblxuLy8gICAgICBjb25zb2xlLmxvZyh4bWwpXG4gICAgICB4bWwuY2hpbGRyZW4oKS5wcmVwZW5kVG8oXCJhLXNjZW5lXCIpO1xuICBcbiAgICAgIGRlYnVnX3htbCA9IHhtbDtcbiAgICAgICQoXCJhLXNjZW5lXCIpLmF0dHIoXCJ2ZXJzaW9uXCIseG1sLmF0dHIoXCJ2ZXJzaW9uXCIpKSAgLy8gdXBkYXRlIHRoZSB2ZXJzaW9uIG51bWJlclxuICAgIH1cbiAgICB0aGlzLmxvYWRTY2VuZShcIkhFQURcIik7XG4gIH1cbiAgXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBTZXJ2ZXJVdGlscygpO1xuXG4vKlxuJChmdW5jdGlvbigpe1xuICBcbiAgLy8gRXZlcnkgc2Vjb25kLCB1cGRhdGUgdGhlIHNjZW5lXG4gIHZhciBzY2VuZVRleHQgPSBcIlwiO1xuICB2YXIgcmVzZXRTY2VuZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbi8vICAgICAgICBjb25zb2xlLmxvZyhcImNoZWNraW5nXCIpXG4gICAgaWYgKGRhdGEgPT0gc2NlbmVUZXh0KSB7XG4gICAgICAgIHNldFRpbWVvdXQobG9hZFNjZW5lLDEwMDApXG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc2NlbmVUZXh0ID0gZGF0YTtcbiAgICB4ID0gc2NlbmVUZXh0O1xuICAgIFxuICAgIGlmICgkKFwiYS1zY2VuZVwiKS5sZW5ndGggPT0gMCkge1xuICAgICAgLy8gTm93IHNob3VsZCBuZXZlciBoYXBwZW5cbiAgICAgICQoXCJib2R5XCIpLnByZXBlbmQoZGF0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBjaCA9ICQoXCJhLXNjZW5lXCIpLmNoaWxkcmVuKCk7XG4gICAgICBmb3IoaSA9IDA7aSA8IGNoLmxlbmd0aDtpKyspIHtcbiAgICAgICAgaWYgKCFjaFtpXS5sb2NhbE5hbWVcbiAgICAgICAgICAgICAgfHwgY2hbaV0ubG9jYWxOYW1lID09IFwiY2FudmFzXCJcbiAgICAgICAgICAgICAgfHwgY2hbaV0ubG9jYWxOYW1lID09IFwiZGl2XCJcbiAgICAgICAgICAgICAgfHwgY2hbaV0ubG9jYWxOYW1lID09IFwiYS1jYW1lcmFcIiBcbiAgICAgICAgICAgICAgfHwgIWNoW2ldLmF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgfHwgKGNoW2ldLmxvY2FsTmFtZSA9PSBcImEtZW50aXR5XCIgXG4gICAgICAgICAgICAgICAgICAgJiYgKGNoW2ldLmF0dHJpYnV0ZXNbXCJjYW1lcmFcIl0gfHwgJChjaFtpXSkuZmluZChcImEtZW50aXR5W2NhbWVyYV1cIikubGVuZ3RoID4gMCB8fCAkKGNoW2ldKS5maW5kKFwiYS1jYW1lcmFcIikubGVuZ3RoID4gMCkpXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmF0dHJpYnV0ZXNbXCJkYXRhLWFmcmFtZS1kZWZhdWx0LWxpZ2h0XCJdXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmF0dHJpYnV0ZXNbXCJkYXRhLWFmcmFtZS1kZWZhdWx0LWNhbWVyYVwiXVxuICAgICAgICApIHtcbi8vICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImxlYXZpbmcgXCIgKyBpKTtcbiAgICAgICAgfSBlbHNlIHtcbi8vICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInJlbW92aW5nIFwiICsgaSlcbiAgICAgICAgICAvLyBUaGlzIGFwcGVhcnMgdG8gYmUgbGVhdmluZyB0aGUgVGhyZWUuanMgR2Vtb2V0cmllcyBiZWhpbmQuIFxuICAgICAgICAgIC8vIFRPRE86IGNoZWNrIGludG8gdGhpc1xuICAgICAgICAgICQoY2hbaV0pLnJlbW92ZSgpXG4gICAgICAgIH1cbiAgICAgIH1cbi8vICAgICAgICAgIGNvbnNvbGUubG9nKFwiY2hpbGRlcm5cIiwkKFwiYS1zY2VuZVwiKS5jaGlsZHJlbigpKVxuICAgICAgLy8gcmVwYWNlIGEtc2NlbmUgd2l0aCB4LXNjZW5lIHRvIGF2b2lkIHRyaWdnZXJpbmcgdGhlIGEtc2NlbmUgY2FsbGJhY2tcbiAgICAgIC8vICh3aGljaCBpbnNlcnRzIHRoZSBkZWZhdWx0cywgYW5kIHRoZXJlZm9yIG1ha2VzIHR3byBjYW1lcmEsIHdoaWNoIGNvbmZ1c2VzXG4gICAgICAvLyAgdGhlIFRIUkVFLmpzIHN1Yi1zeXN0ZW0pLiBOb3RlIHJlcGxhY2Ugb25seSByZXBsYWNlcyB0aGUgKmZpcnN0KiBcbiAgICAgIC8vIGEtc2NlbmUgb2YgdGhlIHN0cmluZywgc28gd2lsbCBub3QgZWZmZWN0IGFueSBwcm9wZXJ0aWVzLlxuICAgICAgdmFyIHhtbCA9ICQoZGF0YS5yZXBsYWNlKFwiYS1zY2VuZVwiLFwieC1zY2VuZVwiKSk7XG4gICAgICAvLyBSZW1vdmUgdGhlIGNhbWVyYSwgaWYgdGhlcmUgaXMgYW4gKGV4cGxpY2l0KSBvbmUuXG4gICAgICAvLyBUaGUgY2FtZXJhIGlzIG5ldmVyIGR5bmFtaWNhbGx5IHVwZGF0ZWQgKGJ1dCBjb250cm9sbGVkIGJ5IHRoZSBpbi1icm93c2VyIHRvb2xzKVxuICAgICAgeG1sLmZpbmQoXCJhLWVudGl0eVtjYW1lcmFdXCIpLnJlbW92ZSgpXG5cbi8vICAgICAgY29uc29sZS5sb2coeG1sKVxuICAgICAgeG1sLmNoaWxkcmVuKCkucHJlcGVuZFRvKFwiYS1zY2VuZVwiKTtcbiAgXG4gICAgICBkZWJ1Z194bWwgPSB4bWw7XG4gICAgICAkKFwiYS1zY2VuZVwiKS5hdHRyKFwidmVyc2lvblwiLHhtbC5hdHRyKFwidmVyc2lvblwiKSkgIC8vIHVwZGF0ZSB0aGUgdmVyc2lvbiBudW1iZXJcbiAgICB9XG4gICAgc2V0VGltZW91dChsb2FkU2NlbmUsMTAwMClcbiAgfVxuICB2YXIgdXBkYXRlU2NlbmUgPSBmdW5jdGlvbihkKSB7XG4vLyAgICBjb25zb2xlLmxvZyhcInVwZGF0ZVNjZW5lXCIsZClcbiAgICBpZiAoZC5jaGFuZ2UgJiYgZC5jaGFuZ2UgPT0gXCJIRUFEXCIpIHtcbiAgICAgIHJldHVybiBsb2FkU2NlbmUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9hZFNjZW5lKFwiUkVMT0FEXCIpO1xuICAgIH1cbiAgfVxuICB2YXIgbG9hZFNjZW5lID0gZnVuY3Rpb24odHkpIHtcbiAgICB2YXIgdmVyc2lvbiA9ICQoXCJhLXNjZW5lXCIpLmF0dHIoXCJ2ZXJzaW9uXCIpO1xuICAgIGlmICh2ZXJzaW9uID09IHVuZGVmaW5lZCB8fCB0eSA9PSBcIlJFTE9BRFwiKSB7XG4gICAgICAvLyBkbyB0aGlzIHRoZSBzbG93IHdheVxuICAgICAgJC5nZXQoIFwiL3NjZW5lXCIsIHJlc2V0U2NlbmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBjaGVjayBmb3IgY2hhbmdlc1xuICAgICAgJC5nZXRKU09OKCBcIi9zdGF0dXMvXCIgKyB2ZXJzaW9uLCB1cGRhdGVTY2VuZSk7ICAgICAgICAgIFxuICAgIH1cbiAgfVxuICBsb2FkU2NlbmUoXCJIRUFEXCIpXG59KTtcblxuKi8iXX0=
