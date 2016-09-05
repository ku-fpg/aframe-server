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
      console.log("edit loop enabled");
      this.pushScene();
    } else {
      console.log("did not find edit");
    }
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
  },
  pushScene: function() {
    $.ajax(
      { type: "PUT",
        url: "/scene",
        data: document.getElementsByTagName('body')[0].innerHTML,
        contentType:  'text/plain; charset=UTF-8',
        dataType: "json",     // result type
        cache: false,
        error: function() { alert("No data found."); },
        success: function(xml) {
             alert("it works");
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9hZnJhbWUtc2VydmVyLXV0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKiBSZWxvYWQgdGhlIGFmcmFtZSBkeW5hbWljYWxseSwgYXMgbmVlZGVkLiBQdXQgdGhlIHNjZW5lIGJhY2sgdG8gdGhlIHNlcnZlciwgYXMgbmVlZGVkLlxuICovXG5cbmZ1bmN0aW9uIFNlcnZlclV0aWxzICgpIHtcblxuICAvLyAoRnJvbSBhZnJhbWUtZWRpdG9yKVxuICAvLyBEZXRlY3QgaWYgdGhlIHNjZW5lIGlzIGFscmVhZHkgbG9hZGVkXG4gIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnY29tcGxldGUnIHx8IGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkZWQnKSB7XG4gICAgdGhpcy5vbkRvbUxvYWRlZCgpO1xuICB9IGVsc2Uge1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCB0aGlzLm9uRG9tTG9hZGVkLmJpbmQodGhpcykpO1xuICB9XG59XG5cblNlcnZlclV0aWxzLnByb3RvdHlwZSA9IHtcblxuICBvbkRvbUxvYWRlZDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuc2NlbmVFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2Etc2NlbmUnKTtcbiAgICBpZiAodGhpcy5zY2VuZUVsLmhhc0xvYWRlZCkge1xuICAgICAgdGhpcy5vblNjZW5lTG9hZGVkKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2NlbmVFbC5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWQnLCB0aGlzLm9uU2NlbmVMb2FkZWQuYmluZCh0aGlzKSk7XG4gICAgfVxuICB9LFxuXG4gIG9uU2NlbmVMb2FkZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBFdmVyeXRoaW5nIGlzIHJlYWR5IHRvIGdvLlxuICAgIC8vIEZyb20gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy85Nzk5NzUvaG93LXRvLWdldC10aGUtdmFsdWUtZnJvbS10aGUtZ2V0LXBhcmFtZXRlcnNcbiAgICB2YXIgcGFyYW1zID0gd2luZG93LmxvY2F0aW9uLnNlYXJjaFxuICAgICAgLnN1YnN0cmluZygxKVxuICAgICAgLnNwbGl0KFwiJlwiKVxuICAgICAgLm1hcCh2ID0+IHYuc3BsaXQoXCI9XCIpKVxuICAgICAgLnJlZHVjZSgobWFwLCBba2V5LCB2YWx1ZV0pID0+IG1hcC5zZXQoa2V5LCBkZWNvZGVVUklDb21wb25lbnQodmFsdWUpKSwgbmV3IE1hcCgpKVxuICAgIGNvbnNvbGUubG9nKFwib25TY2VuZUxvYWRlZCAhXCIscGFyYW1zKTtcbiAgICAvLyBEbyB3ZSBuZWVkIHRvIHNlbmQgdGhlIGVkaXRlZCBTY2VuZSBiYWNrIHRvIHRoZSBzZXJ2ZXIgcGVyaW9kaWNhbGx5P1xuICAgIGlmIChwYXJhbXMuZ2V0KFwiZWRpdFwiKSAhPSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiZWRpdCBsb29wIGVuYWJsZWRcIik7XG4gICAgICB0aGlzLnB1c2hTY2VuZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZyhcImRpZCBub3QgZmluZCBlZGl0XCIpO1xuICAgIH1cbiAgICB0aGlzLmxvYWRTY2VuZShcIkhFQURcIikgICAgXG4gIH0sXG4gIGxvYWRTY2VuZTogZnVuY3Rpb24odHkpIHtcbiAgICB2YXIgdmVyc2lvbiA9ICQoXCJhLXNjZW5lXCIpLmF0dHIoXCJ2ZXJzaW9uXCIpO1xuICAgIGlmICh2ZXJzaW9uID09IHVuZGVmaW5lZCB8fCB0eSA9PSBcIlJFTE9BRFwiKSB7XG4gICAgICAvLyBkbyB0aGlzIHRoZSBzbG93IHdheVxuICAgICAgJC5nZXQoIFwiL3NjZW5lXCIsIHRoaXMucmVzZXRTY2VuZS5iaW5kKHRoaXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY2hlY2sgZm9yIGNoYW5nZXNcbiAgICAgICQuZ2V0SlNPTiggXCIvc3RhdHVzL1wiICsgdmVyc2lvbiwgdGhpcy51cGRhdGVTY2VuZS5iaW5kKHRoaXMpKTsgICAgICAgICAgXG4gICAgfVxuICB9LFxuICB1cGRhdGVTY2VuZTogZnVuY3Rpb24oZCkge1xuLy8gICAgY29uc29sZS5sb2coXCJ1cGRhdGVTY2VuZVwiLGQpXG4gICAgaWYgKGQuY2hhbmdlICYmIGQuY2hhbmdlID09IFwiSEVBRFwiKSB7XG4gICAgICB0aGlzLmxvYWRTY2VuZShcIkhFQURcIik7XG4gICAgfSBlbHNlIGlmIChkLmNoYW5nZSAmJiBkLmNoYW5nZSA9PSBcIkRFTFRBU1wiKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIkRFTFRBU1wiLGQpXG4gICAgICBkLmNoYW5nZXMuZm9yRWFjaChmdW5jdGlvbihvKSB7XG4gICAgICAgIHZhciBxID0gby5wYXRoWzBdO1xuICAgICAgICBmb3IgKHZhciBpID0gMTtpIDwgby5wYXRoLmxlbmd0aDtpKz0yKSB7XG4gICAgICAgICAgcSArPSBcIiA+IFwiICsgby5wYXRoW2krMV0gKyBcIjpudGgtb2YtdHlwZShcIiArIChvLnBhdGhbaV0rMSkgKyBcIilcIlxuICAgICAgICB9XG4gICAgICAgIC8vIFRoaXMgaXMgd2hlcmUgd2UgZG8gdGhlIG1pY3JvLXVwZGF0ZXNcbiAgICAgICAgJChxKS5hdHRyKG8uYXR0cixvLnZhbHVlKTtcbiAgICAgICAgY29uc29sZS5sb2cobyxxKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5sb2FkU2NlbmUoXCJIRUFEXCIpOyAgLy8gdHJ5IHJlbG9hZCB0aGUgc2NlbmVcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5sb2FkU2NlbmUoXCJSRUxPQURcIik7XG4gICAgfVxuICB9LFxuICByZXNldFNjZW5lOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgaWYgKCQoXCJhLXNjZW5lXCIpLmxlbmd0aCA9PSAwKSB7XG4gICAgICAvLyBOb3cgc2hvdWxkIG5ldmVyIGhhcHBlbixcbiAgICAgIC8vIGJ1dCBpZiBpdCBkb2VzLCBqdXN0IGxvYWQgdGhlIERPTSBkaXJlY3RseS5cbiAgICAgICQoXCJib2R5XCIpLnByZXBlbmQoZGF0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBjaCA9ICQoXCJhLXNjZW5lXCIpLmNoaWxkcmVuKCk7XG4gICAgICBmb3IoaSA9IDA7aSA8IGNoLmxlbmd0aDtpKyspIHtcbiAgICAgICAgaWYgKCFjaFtpXS5sb2NhbE5hbWVcbiAgICAgICAgICAgICAgfHwgY2hbaV0ubG9jYWxOYW1lID09IFwiY2FudmFzXCJcbiAgICAgICAgICAgICAgfHwgY2hbaV0ubG9jYWxOYW1lID09IFwiZGl2XCJcbiAgICAgICAgICAgICAgfHwgY2hbaV0ubG9jYWxOYW1lID09IFwiYS1jYW1lcmFcIiBcbiAgICAgICAgICAgICAgfHwgIWNoW2ldLmF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgfHwgKGNoW2ldLmxvY2FsTmFtZSA9PSBcImEtZW50aXR5XCIgXG4gICAgICAgICAgICAgICAgICAgJiYgKGNoW2ldLmF0dHJpYnV0ZXNbXCJjYW1lcmFcIl0gfHwgJChjaFtpXSkuZmluZChcImEtZW50aXR5W2NhbWVyYV1cIikubGVuZ3RoID4gMCB8fCAkKGNoW2ldKS5maW5kKFwiYS1jYW1lcmFcIikubGVuZ3RoID4gMCkpXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmF0dHJpYnV0ZXNbXCJkYXRhLWFmcmFtZS1kZWZhdWx0LWxpZ2h0XCJdXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmF0dHJpYnV0ZXNbXCJkYXRhLWFmcmFtZS1kZWZhdWx0LWNhbWVyYVwiXVxuICAgICAgICApIHtcbi8vICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImxlYXZpbmcgXCIgKyBpKTtcbiAgICAgICAgfSBlbHNlIHtcbi8vICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInJlbW92aW5nIFwiICsgaSlcbiAgICAgICAgICAvLyBUaGlzIGFwcGVhcnMgdG8gYmUgbGVhdmluZyB0aGUgVGhyZWUuanMgR2Vtb2V0cmllcyBiZWhpbmQuIFxuICAgICAgICAgIC8vIFRPRE86IGNoZWNrIGludG8gdGhpc1xuICAgICAgICAgICQoY2hbaV0pLnJlbW92ZSgpXG4gICAgICAgIH1cbiAgICAgIH1cbi8vICAgICAgICAgIGNvbnNvbGUubG9nKFwiY2hpbGRlcm5cIiwkKFwiYS1zY2VuZVwiKS5jaGlsZHJlbigpKVxuICAgICAgLy8gcmVwYWNlIGEtc2NlbmUgd2l0aCB4LXNjZW5lIHRvIGF2b2lkIHRyaWdnZXJpbmcgdGhlIGEtc2NlbmUgY2FsbGJhY2tcbiAgICAgIC8vICh3aGljaCBpbnNlcnRzIHRoZSBkZWZhdWx0cywgYW5kIHRoZXJlZm9yIG1ha2VzIHR3byBjYW1lcmEsIHdoaWNoIGNvbmZ1c2VzXG4gICAgICAvLyAgdGhlIFRIUkVFLmpzIHN1Yi1zeXN0ZW0pLiBOb3RlIHJlcGxhY2Ugb25seSByZXBsYWNlcyB0aGUgKmZpcnN0KiBcbiAgICAgIC8vIGEtc2NlbmUgb2YgdGhlIHN0cmluZywgc28gd2lsbCBub3QgZWZmZWN0IGFueSBwcm9wZXJ0aWVzLlxuICAgICAgdmFyIHhtbCA9ICQoZGF0YS5yZXBsYWNlKFwiYS1zY2VuZVwiLFwieC1zY2VuZVwiKSk7XG4gICAgICAvLyBSZW1vdmUgdGhlIGNhbWVyYSwgaWYgdGhlcmUgaXMgYW4gKGV4cGxpY2l0KSBvbmUuXG4gICAgICAvLyBUaGUgY2FtZXJhIGlzIG5ldmVyIGR5bmFtaWNhbGx5IHVwZGF0ZWQgKGJ1dCBjb250cm9sbGVkIGJ5IHRoZSBpbi1icm93c2VyIHRvb2xzKVxuICAgICAgeG1sLmZpbmQoXCJhLWVudGl0eVtjYW1lcmFdXCIpLnJlbW92ZSgpXG5cbi8vICAgICAgY29uc29sZS5sb2coeG1sKVxuICAgICAgeG1sLmNoaWxkcmVuKCkucHJlcGVuZFRvKFwiYS1zY2VuZVwiKTtcbiAgXG4gICAgICBkZWJ1Z194bWwgPSB4bWw7XG4gICAgICAkKFwiYS1zY2VuZVwiKS5hdHRyKFwidmVyc2lvblwiLHhtbC5hdHRyKFwidmVyc2lvblwiKSkgIC8vIHVwZGF0ZSB0aGUgdmVyc2lvbiBudW1iZXJcbiAgICB9XG4gICAgdGhpcy5sb2FkU2NlbmUoXCJIRUFEXCIpO1xuICB9LFxuICBwdXNoU2NlbmU6IGZ1bmN0aW9uKCkge1xuICAgICQuYWpheChcbiAgICAgIHsgdHlwZTogXCJQVVRcIixcbiAgICAgICAgdXJsOiBcIi9zY2VuZVwiLFxuICAgICAgICBkYXRhOiBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYm9keScpWzBdLmlubmVySFRNTCxcbiAgICAgICAgY29udGVudFR5cGU6ICAndGV4dC9wbGFpbjsgY2hhcnNldD1VVEYtOCcsXG4gICAgICAgIGRhdGFUeXBlOiBcImpzb25cIiwgICAgIC8vIHJlc3VsdCB0eXBlXG4gICAgICAgIGNhY2hlOiBmYWxzZSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKCkgeyBhbGVydChcIk5vIGRhdGEgZm91bmQuXCIpOyB9LFxuICAgICAgICBzdWNjZXNzOiBmdW5jdGlvbih4bWwpIHtcbiAgICAgICAgICAgICBhbGVydChcIml0IHdvcmtzXCIpO1xuLy8gICAgICAgICAgIGFsZXJ0KCQoeG1sKS5maW5kKFwicHJvamVjdFwiKVswXS5hdHRyKFwiaWRcIikpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGNvbnNvbGUubG9nKFwicHVzaFNjZW5lIC4uLlwiKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBuZXcgU2VydmVyVXRpbHMoKTtcblxuLypcbiQoZnVuY3Rpb24oKXtcbiAgXG4gIC8vIEV2ZXJ5IHNlY29uZCwgdXBkYXRlIHRoZSBzY2VuZVxuICB2YXIgc2NlbmVUZXh0ID0gXCJcIjtcbiAgdmFyIHJlc2V0U2NlbmUgPSBmdW5jdGlvbihkYXRhKSB7XG4vLyAgICAgICAgY29uc29sZS5sb2coXCJjaGVja2luZ1wiKVxuICAgIGlmIChkYXRhID09IHNjZW5lVGV4dCkge1xuICAgICAgICBzZXRUaW1lb3V0KGxvYWRTY2VuZSwxMDAwKVxuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHNjZW5lVGV4dCA9IGRhdGE7XG4gICAgeCA9IHNjZW5lVGV4dDtcbiAgICBcbiAgICBpZiAoJChcImEtc2NlbmVcIikubGVuZ3RoID09IDApIHtcbiAgICAgIC8vIE5vdyBzaG91bGQgbmV2ZXIgaGFwcGVuXG4gICAgICAkKFwiYm9keVwiKS5wcmVwZW5kKGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY2ggPSAkKFwiYS1zY2VuZVwiKS5jaGlsZHJlbigpO1xuICAgICAgZm9yKGkgPSAwO2kgPCBjaC5sZW5ndGg7aSsrKSB7XG4gICAgICAgIGlmICghY2hbaV0ubG9jYWxOYW1lXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImNhbnZhc1wiXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImRpdlwiXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImEtY2FtZXJhXCIgXG4gICAgICAgICAgICAgIHx8ICFjaFtpXS5hdHRyaWJ1dGVzXG4gICAgICAgICAgICAgIHx8IChjaFtpXS5sb2NhbE5hbWUgPT0gXCJhLWVudGl0eVwiIFxuICAgICAgICAgICAgICAgICAgICYmIChjaFtpXS5hdHRyaWJ1dGVzW1wiY2FtZXJhXCJdIHx8ICQoY2hbaV0pLmZpbmQoXCJhLWVudGl0eVtjYW1lcmFdXCIpLmxlbmd0aCA+IDAgfHwgJChjaFtpXSkuZmluZChcImEtY2FtZXJhXCIpLmxlbmd0aCA+IDApKVxuICAgICAgICAgICAgICB8fCBjaFtpXS5hdHRyaWJ1dGVzW1wiZGF0YS1hZnJhbWUtZGVmYXVsdC1saWdodFwiXVxuICAgICAgICAgICAgICB8fCBjaFtpXS5hdHRyaWJ1dGVzW1wiZGF0YS1hZnJhbWUtZGVmYXVsdC1jYW1lcmFcIl1cbiAgICAgICAgKSB7XG4vLyAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJsZWF2aW5nIFwiICsgaSk7XG4gICAgICAgIH0gZWxzZSB7XG4vLyAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJyZW1vdmluZyBcIiArIGkpXG4gICAgICAgICAgLy8gVGhpcyBhcHBlYXJzIHRvIGJlIGxlYXZpbmcgdGhlIFRocmVlLmpzIEdlbW9ldHJpZXMgYmVoaW5kLiBcbiAgICAgICAgICAvLyBUT0RPOiBjaGVjayBpbnRvIHRoaXNcbiAgICAgICAgICAkKGNoW2ldKS5yZW1vdmUoKVxuICAgICAgICB9XG4gICAgICB9XG4vLyAgICAgICAgICBjb25zb2xlLmxvZyhcImNoaWxkZXJuXCIsJChcImEtc2NlbmVcIikuY2hpbGRyZW4oKSlcbiAgICAgIC8vIHJlcGFjZSBhLXNjZW5lIHdpdGggeC1zY2VuZSB0byBhdm9pZCB0cmlnZ2VyaW5nIHRoZSBhLXNjZW5lIGNhbGxiYWNrXG4gICAgICAvLyAod2hpY2ggaW5zZXJ0cyB0aGUgZGVmYXVsdHMsIGFuZCB0aGVyZWZvciBtYWtlcyB0d28gY2FtZXJhLCB3aGljaCBjb25mdXNlc1xuICAgICAgLy8gIHRoZSBUSFJFRS5qcyBzdWItc3lzdGVtKS4gTm90ZSByZXBsYWNlIG9ubHkgcmVwbGFjZXMgdGhlICpmaXJzdCogXG4gICAgICAvLyBhLXNjZW5lIG9mIHRoZSBzdHJpbmcsIHNvIHdpbGwgbm90IGVmZmVjdCBhbnkgcHJvcGVydGllcy5cbiAgICAgIHZhciB4bWwgPSAkKGRhdGEucmVwbGFjZShcImEtc2NlbmVcIixcIngtc2NlbmVcIikpO1xuICAgICAgLy8gUmVtb3ZlIHRoZSBjYW1lcmEsIGlmIHRoZXJlIGlzIGFuIChleHBsaWNpdCkgb25lLlxuICAgICAgLy8gVGhlIGNhbWVyYSBpcyBuZXZlciBkeW5hbWljYWxseSB1cGRhdGVkIChidXQgY29udHJvbGxlZCBieSB0aGUgaW4tYnJvd3NlciB0b29scylcbiAgICAgIHhtbC5maW5kKFwiYS1lbnRpdHlbY2FtZXJhXVwiKS5yZW1vdmUoKVxuXG4vLyAgICAgIGNvbnNvbGUubG9nKHhtbClcbiAgICAgIHhtbC5jaGlsZHJlbigpLnByZXBlbmRUbyhcImEtc2NlbmVcIik7XG4gIFxuICAgICAgZGVidWdfeG1sID0geG1sO1xuICAgICAgJChcImEtc2NlbmVcIikuYXR0cihcInZlcnNpb25cIix4bWwuYXR0cihcInZlcnNpb25cIikpICAvLyB1cGRhdGUgdGhlIHZlcnNpb24gbnVtYmVyXG4gICAgfVxuICAgIHNldFRpbWVvdXQobG9hZFNjZW5lLDEwMDApXG4gIH1cbiAgdmFyIHVwZGF0ZVNjZW5lID0gZnVuY3Rpb24oZCkge1xuLy8gICAgY29uc29sZS5sb2coXCJ1cGRhdGVTY2VuZVwiLGQpXG4gICAgaWYgKGQuY2hhbmdlICYmIGQuY2hhbmdlID09IFwiSEVBRFwiKSB7XG4gICAgICByZXR1cm4gbG9hZFNjZW5lKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvYWRTY2VuZShcIlJFTE9BRFwiKTtcbiAgICB9XG4gIH1cbiAgdmFyIGxvYWRTY2VuZSA9IGZ1bmN0aW9uKHR5KSB7XG4gICAgdmFyIHZlcnNpb24gPSAkKFwiYS1zY2VuZVwiKS5hdHRyKFwidmVyc2lvblwiKTtcbiAgICBpZiAodmVyc2lvbiA9PSB1bmRlZmluZWQgfHwgdHkgPT0gXCJSRUxPQURcIikge1xuICAgICAgLy8gZG8gdGhpcyB0aGUgc2xvdyB3YXlcbiAgICAgICQuZ2V0KCBcIi9zY2VuZVwiLCByZXNldFNjZW5lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY2hlY2sgZm9yIGNoYW5nZXNcbiAgICAgICQuZ2V0SlNPTiggXCIvc3RhdHVzL1wiICsgdmVyc2lvbiwgdXBkYXRlU2NlbmUpOyAgICAgICAgICBcbiAgICB9XG4gIH1cbiAgbG9hZFNjZW5lKFwiSEVBRFwiKVxufSk7XG5cbiovIl19
