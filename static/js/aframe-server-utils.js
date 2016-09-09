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
    if (this.sceneEl == null) {
      return;
    }
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
    }
    if (params.get("load") != undefined) {
      this.loadScene("HEAD")      
    }
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
        url: "/REST/shadow",
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
  },

  initDiff: function() {
    var self = this;
    $.get("/REST/scene", function(o) {
            console.log("/REST/scene",o);
            self.scene = o;
            self.renderDiff();
    });
    $.get("/REST/scene", function(o) {
            console.log("/REST/scene",o);
            self.shadow = o;
            self.renderDiff();
    });
  },

  renderNode: function(xml) {
          if (!xml.localName) {
                  return "???";
          }
          var txt = xml.localName;
          txt += "\n<ul>\n";
          for(var i = 0;i < xml.attributes.length;i++) {
                  var item = xml.attributes.item(i);
                  txt += "<li>";
                  txt += item.name;
                  txt += " = ";
                  txt += "\"" + item.value + "\"";
                  txt += "</li>";
          }
          for(var i = 0;i < xml.children.length;i++) {
                  var child = xml.children[i];
                  txt += "<li>";
                  txt += this.renderNode(child);
                  txt += "</li>";
          }
          txt += "\n</ul>\n";
          return txt;
  },

  renderDiff: function(){
    var xml = $(this.scene)[0];
    var html = this.renderNode(xml);
    $("#target").html(html);
  }
  
  
/*
        var scene  = null;
        var shadow = null;

        var renderNode = function(xml) {
                if (!xml.localName) {
                        return "???";
                }
                var txt = xml.localName;
                txt += "\n<ul>\n";
                for(var i = 0;i < xml.attributes.length;i++) {
                        var item = xml.attributes.item(i);
                        txt += "<li>";
                        txt += item.name;
                        txt += " = ";
                        txt += "\"" + item.value + "\"";
                        txt += "</li>";
                }
                for(var i = 0;i < xml.children.length;i++) {
                        var child = xml.children[i];
                        txt += "<li>";
                        txt += renderNode(child);
                        txt += "</li>";
                }
                txt += "\n</ul>\n";
                return txt;
        }
        
        var render = function() {
           var xml = $(scene)[0];
           var html = renderNode(xml);
           $("#target").html(html);
        };

*/  
  
};

module.exports = new ServerUtils();


},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9hZnJhbWUtc2VydmVyLXV0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyogUmVsb2FkIHRoZSBhZnJhbWUgZHluYW1pY2FsbHksIGFzIG5lZWRlZC4gUHV0IHRoZSBzY2VuZSBiYWNrIHRvIHRoZSBzZXJ2ZXIsIGFzIG5lZWRlZC5cbiAqL1xuXG5mdW5jdGlvbiBTZXJ2ZXJVdGlscyAoKSB7XG5cbiAgLy8gKEZyb20gYWZyYW1lLWVkaXRvcilcbiAgLy8gRGV0ZWN0IGlmIHRoZSBzY2VuZSBpcyBhbHJlYWR5IGxvYWRlZFxuICBpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gJ2NvbXBsZXRlJyB8fCBkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnbG9hZGVkJykge1xuICAgIHRoaXMub25Eb21Mb2FkZWQoKTtcbiAgfSBlbHNlIHtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgdGhpcy5vbkRvbUxvYWRlZC5iaW5kKHRoaXMpKTtcbiAgfVxufVxuXG5TZXJ2ZXJVdGlscy5wcm90b3R5cGUgPSB7XG5cbiAgb25Eb21Mb2FkZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnNjZW5lRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdhLXNjZW5lJyk7XG4gICAgaWYgKHRoaXMuc2NlbmVFbCA9PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICh0aGlzLnNjZW5lRWwuaGFzTG9hZGVkKSB7XG4gICAgICB0aGlzLm9uU2NlbmVMb2FkZWQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zY2VuZUVsLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZCcsIHRoaXMub25TY2VuZUxvYWRlZC5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH0sXG5cbiAgb25TY2VuZUxvYWRlZDogZnVuY3Rpb24gKCkge1xuICAgIC8vIEV2ZXJ5dGhpbmcgaXMgcmVhZHkgdG8gZ28uXG4gICAgLy8gRnJvbSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzk3OTk3NS9ob3ctdG8tZ2V0LXRoZS12YWx1ZS1mcm9tLXRoZS1nZXQtcGFyYW1ldGVyc1xuICAgIHZhciBwYXJhbXMgPSB3aW5kb3cubG9jYXRpb24uc2VhcmNoXG4gICAgICAuc3Vic3RyaW5nKDEpXG4gICAgICAuc3BsaXQoXCImXCIpXG4gICAgICAubWFwKHYgPT4gdi5zcGxpdChcIj1cIikpXG4gICAgICAucmVkdWNlKChtYXAsIFtrZXksIHZhbHVlXSkgPT4gbWFwLnNldChrZXksIGRlY29kZVVSSUNvbXBvbmVudCh2YWx1ZSkpLCBuZXcgTWFwKCkpXG4gICAgY29uc29sZS5sb2coXCJvblNjZW5lTG9hZGVkICFcIixwYXJhbXMpO1xuICAgIC8vIERvIHdlIG5lZWQgdG8gc2VuZCB0aGUgZWRpdGVkIFNjZW5lIGJhY2sgdG8gdGhlIHNlcnZlciBwZXJpb2RpY2FsbHk/XG4gICAgaWYgKHBhcmFtcy5nZXQoXCJlZGl0XCIpICE9IHVuZGVmaW5lZCkge1xuICAgICAgY29uc29sZS5sb2coXCJlZGl0IGtleSAocytjbnRsK2FsdCkgZW5hYmxlZFwiKTtcbiAgICAgIC8vIChmcm9tIGFmcmFtZSdzIGluc3BlY3Rvci5qcylcbiAgICAgIHRoaXMub25LZXlkb3duID0gdGhpcy5vbktleWRvd24uYmluZCh0aGlzKTtcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5vbktleWRvd24pO1xuICAgICAgdGhpcy5wdXNoU2NlbmUoKTsgLy8gQW5kIGFsc28gcHVzaCBiYWNrIHRoZSBpbml0aWFsIHZlcnNpb24gb2YgdGhlIHNjZW5lIHRvIHRoZSBzaGFkb3cgQUZyYW1lIE9iamVjdC5cbiAgICB9XG4gICAgaWYgKHBhcmFtcy5nZXQoXCJsb2FkXCIpICE9IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5sb2FkU2NlbmUoXCJIRUFEXCIpICAgICAgXG4gICAgfVxuICB9LFxuICBvbktleWRvd246IGZ1bmN0aW9uIChldnQpIHtcbiAgICAvLyAoZnJvbSBhZnJhbWUncyBpbnNwZWN0b3IuanMpXG4gICAgLy8gQWx0ICsgQ3RybCArIHNcbiAgICBjb25zb2xlLmxvZyhcIm9uS2V5ZG93blwiLGV2dClcbiAgICB2YXIgc2hvcnRjdXRQcmVzc2VkID0gZXZ0LmtleUNvZGUgPT09IDgzICYmIGV2dC5jdHJsS2V5ICYmIGV2dC5hbHRLZXk7XG4gICAgaWYgKCFzaG9ydGN1dFByZXNzZWQpIHsgcmV0dXJuOyB9XG4gICAgdGhpcy5wdXNoU2NlbmUoKTtcbiAgfSxcbiAgbG9hZFNjZW5lOiBmdW5jdGlvbih0eSkge1xuICAgIHZhciB2ZXJzaW9uID0gJChcImEtc2NlbmVcIikuYXR0cihcInZlcnNpb25cIik7XG4gICAgaWYgKHZlcnNpb24gPT0gdW5kZWZpbmVkIHx8IHR5ID09IFwiUkVMT0FEXCIpIHtcbiAgICAgIC8vIGRvIHRoaXMgdGhlIHNsb3cgd2F5XG4gICAgICAkLmdldCggXCIvUkVTVC9zY2VuZVwiLCB0aGlzLnJlc2V0U2NlbmUuYmluZCh0aGlzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNoZWNrIGZvciBjaGFuZ2VzXG4gICAgICAkLmdldEpTT04oIFwiL1JFU1Qvc2NlbmUvXCIgKyB2ZXJzaW9uLCB0aGlzLnVwZGF0ZVNjZW5lLmJpbmQodGhpcykpOyAgICAgICAgICBcbiAgICB9XG4gIH0sXG4gIHVwZGF0ZVNjZW5lOiBmdW5jdGlvbihkKSB7XG4vLyAgICBjb25zb2xlLmxvZyhcInVwZGF0ZVNjZW5lXCIsZClcbiAgICBpZiAoZC5jaGFuZ2UgJiYgZC5jaGFuZ2UgPT0gXCJIRUFEXCIpIHtcbiAgICAgIHRoaXMubG9hZFNjZW5lKFwiSEVBRFwiKTtcbiAgICB9IGVsc2UgaWYgKGQuY2hhbmdlICYmIGQuY2hhbmdlID09IFwiREVMVEFTXCIpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiREVMVEFTXCIsZClcbiAgICAgIGQuY2hhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKG8pIHtcbiAgICAgICAgdmFyIHEgPSBvLnBhdGhbMF07XG4gICAgICAgIGZvciAodmFyIGkgPSAxO2kgPCBvLnBhdGgubGVuZ3RoO2krPTIpIHtcbiAgICAgICAgICBxICs9IFwiID4gXCIgKyBvLnBhdGhbaSsxXSArIFwiOm50aC1vZi10eXBlKFwiICsgKG8ucGF0aFtpXSsxKSArIFwiKVwiXG4gICAgICAgIH1cbiAgICAgICAgLy8gVGhpcyBpcyB3aGVyZSB3ZSBkbyB0aGUgbWljcm8tdXBkYXRlc1xuICAgICAgICAkKHEpLmF0dHIoby5hdHRyLG8udmFsdWUpO1xuICAgICAgICBjb25zb2xlLmxvZyhvLHEpO1xuICAgICAgfSk7XG4gICAgICB0aGlzLmxvYWRTY2VuZShcIkhFQURcIik7ICAvLyB0cnkgcmVsb2FkIHRoZSBzY2VuZVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxvYWRTY2VuZShcIlJFTE9BRFwiKTtcbiAgICB9XG4gIH0sXG4gIHJlc2V0U2NlbmU6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBpZiAoJChcImEtc2NlbmVcIikubGVuZ3RoID09IDApIHtcbiAgICAgIC8vIE5vdyBzaG91bGQgbmV2ZXIgaGFwcGVuLFxuICAgICAgLy8gYnV0IGlmIGl0IGRvZXMsIGp1c3QgbG9hZCB0aGUgRE9NIGRpcmVjdGx5LlxuICAgICAgJChcImJvZHlcIikucHJlcGVuZChkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGNoID0gJChcImEtc2NlbmVcIikuY2hpbGRyZW4oKTtcbiAgICAgIGZvcihpID0gMDtpIDwgY2gubGVuZ3RoO2krKykge1xuICAgICAgICBpZiAoIWNoW2ldLmxvY2FsTmFtZVxuICAgICAgICAgICAgICB8fCBjaFtpXS5sb2NhbE5hbWUgPT0gXCJjYW52YXNcIlxuICAgICAgICAgICAgICB8fCBjaFtpXS5sb2NhbE5hbWUgPT0gXCJkaXZcIlxuICAgICAgICAgICAgICB8fCBjaFtpXS5sb2NhbE5hbWUgPT0gXCJhLWNhbWVyYVwiIFxuICAgICAgICAgICAgICB8fCAhY2hbaV0uYXR0cmlidXRlc1xuICAgICAgICAgICAgICB8fCAoY2hbaV0ubG9jYWxOYW1lID09IFwiYS1lbnRpdHlcIiBcbiAgICAgICAgICAgICAgICAgICAmJiAoY2hbaV0uYXR0cmlidXRlc1tcImNhbWVyYVwiXSB8fCAkKGNoW2ldKS5maW5kKFwiYS1lbnRpdHlbY2FtZXJhXVwiKS5sZW5ndGggPiAwIHx8ICQoY2hbaV0pLmZpbmQoXCJhLWNhbWVyYVwiKS5sZW5ndGggPiAwKSlcbiAgICAgICAgICAgICAgfHwgY2hbaV0uYXR0cmlidXRlc1tcImRhdGEtYWZyYW1lLWRlZmF1bHQtbGlnaHRcIl1cbiAgICAgICAgICAgICAgfHwgY2hbaV0uYXR0cmlidXRlc1tcImRhdGEtYWZyYW1lLWRlZmF1bHQtY2FtZXJhXCJdXG4gICAgICAgICkge1xuLy8gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibGVhdmluZyBcIiArIGkpO1xuICAgICAgICB9IGVsc2Uge1xuLy8gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwicmVtb3ZpbmcgXCIgKyBpKVxuICAgICAgICAgIC8vIFRoaXMgYXBwZWFycyB0byBiZSBsZWF2aW5nIHRoZSBUaHJlZS5qcyBHZW1vZXRyaWVzIGJlaGluZC4gXG4gICAgICAgICAgLy8gVE9ETzogY2hlY2sgaW50byB0aGlzXG4gICAgICAgICAgJChjaFtpXSkucmVtb3ZlKClcbiAgICAgICAgfVxuICAgICAgfVxuLy8gICAgICAgICAgY29uc29sZS5sb2coXCJjaGlsZGVyblwiLCQoXCJhLXNjZW5lXCIpLmNoaWxkcmVuKCkpXG4gICAgICAvLyByZXBhY2UgYS1zY2VuZSB3aXRoIHgtc2NlbmUgdG8gYXZvaWQgdHJpZ2dlcmluZyB0aGUgYS1zY2VuZSBjYWxsYmFja1xuICAgICAgLy8gKHdoaWNoIGluc2VydHMgdGhlIGRlZmF1bHRzLCBhbmQgdGhlcmVmb3IgbWFrZXMgdHdvIGNhbWVyYSwgd2hpY2ggY29uZnVzZXNcbiAgICAgIC8vICB0aGUgVEhSRUUuanMgc3ViLXN5c3RlbSkuIE5vdGUgcmVwbGFjZSBvbmx5IHJlcGxhY2VzIHRoZSAqZmlyc3QqIFxuICAgICAgLy8gYS1zY2VuZSBvZiB0aGUgc3RyaW5nLCBzbyB3aWxsIG5vdCBlZmZlY3QgYW55IHByb3BlcnRpZXMuXG4gICAgICB2YXIgeG1sID0gJChkYXRhLnJlcGxhY2UoXCJhLXNjZW5lXCIsXCJ4LXNjZW5lXCIpKTtcbiAgICAgIC8vIFJlbW92ZSB0aGUgY2FtZXJhLCBpZiB0aGVyZSBpcyBhbiAoZXhwbGljaXQpIG9uZS5cbiAgICAgIC8vIFRoZSBjYW1lcmEgaXMgbmV2ZXIgZHluYW1pY2FsbHkgdXBkYXRlZCAoYnV0IGNvbnRyb2xsZWQgYnkgdGhlIGluLWJyb3dzZXIgdG9vbHMpXG4gICAgICB4bWwuZmluZChcImEtZW50aXR5W2NhbWVyYV1cIikucmVtb3ZlKClcblxuLy8gICAgICBjb25zb2xlLmxvZyh4bWwpXG4gICAgICB4bWwuY2hpbGRyZW4oKS5wcmVwZW5kVG8oXCJhLXNjZW5lXCIpO1xuICBcbiAgICAgIGRlYnVnX3htbCA9IHhtbDtcbiAgICAgICQoXCJhLXNjZW5lXCIpLmF0dHIoXCJ2ZXJzaW9uXCIseG1sLmF0dHIoXCJ2ZXJzaW9uXCIpKSAgLy8gdXBkYXRlIHRoZSB2ZXJzaW9uIG51bWJlclxuICAgIH1cbiAgICB0aGlzLmxvYWRTY2VuZShcIkhFQURcIik7XG4gIH0sXG4gIHB1c2hTY2VuZTogZnVuY3Rpb24oKSB7XG4gICAgY29uc29sZS5sb2coXCJwdXNoU2NlbmVcIilcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgJC5hamF4KFxuICAgICAgeyB0eXBlOiBcIlBVVFwiLFxuICAgICAgICB1cmw6IFwiL1JFU1Qvc2hhZG93XCIsXG4gICAgICAgIGRhdGE6IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdib2R5JylbMF0uaW5uZXJIVE1MLFxuICAgICAgICBjb250ZW50VHlwZTogICd0ZXh0L3BsYWluOyBjaGFyc2V0PVVURi04JyxcbiAgICAgICAgZGF0YVR5cGU6IFwianNvblwiLCAgICAgLy8gcmVzdWx0IHR5cGVcbiAgICAgICAgY2FjaGU6IGZhbHNlLFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oKSB7XG4vLyAgICAgICAgICBjb25zb2xlLmxvZyhcIkZhaWxlZCB0byBzZW5kIERPTTsgcmV0cnlpbmdcIik7XG4gICAgICAgIH0sXG4gICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uKHhtbCkge1xuLy8gICAgICAgICAgICAgYWxlcnQoXCJpdCB3b3Jrc1wiKTtcbi8vICAgICAgICAgICBhbGVydCgkKHhtbCkuZmluZChcInByb2plY3RcIilbMF0uYXR0cihcImlkXCIpKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBjb25zb2xlLmxvZyhcInB1c2hTY2VuZSAuLi5cIik7XG4gIH0sXG5cbiAgaW5pdERpZmY6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAkLmdldChcIi9SRVNUL3NjZW5lXCIsIGZ1bmN0aW9uKG8pIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiL1JFU1Qvc2NlbmVcIixvKTtcbiAgICAgICAgICAgIHNlbGYuc2NlbmUgPSBvO1xuICAgICAgICAgICAgc2VsZi5yZW5kZXJEaWZmKCk7XG4gICAgfSk7XG4gICAgJC5nZXQoXCIvUkVTVC9zY2VuZVwiLCBmdW5jdGlvbihvKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIi9SRVNUL3NjZW5lXCIsbyk7XG4gICAgICAgICAgICBzZWxmLnNoYWRvdyA9IG87XG4gICAgICAgICAgICBzZWxmLnJlbmRlckRpZmYoKTtcbiAgICB9KTtcbiAgfSxcblxuICByZW5kZXJOb2RlOiBmdW5jdGlvbih4bWwpIHtcbiAgICAgICAgICBpZiAoIXhtbC5sb2NhbE5hbWUpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIj8/P1wiO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgdHh0ID0geG1sLmxvY2FsTmFtZTtcbiAgICAgICAgICB0eHQgKz0gXCJcXG48dWw+XFxuXCI7XG4gICAgICAgICAgZm9yKHZhciBpID0gMDtpIDwgeG1sLmF0dHJpYnV0ZXMubGVuZ3RoO2krKykge1xuICAgICAgICAgICAgICAgICAgdmFyIGl0ZW0gPSB4bWwuYXR0cmlidXRlcy5pdGVtKGkpO1xuICAgICAgICAgICAgICAgICAgdHh0ICs9IFwiPGxpPlwiO1xuICAgICAgICAgICAgICAgICAgdHh0ICs9IGl0ZW0ubmFtZTtcbiAgICAgICAgICAgICAgICAgIHR4dCArPSBcIiA9IFwiO1xuICAgICAgICAgICAgICAgICAgdHh0ICs9IFwiXFxcIlwiICsgaXRlbS52YWx1ZSArIFwiXFxcIlwiO1xuICAgICAgICAgICAgICAgICAgdHh0ICs9IFwiPC9saT5cIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yKHZhciBpID0gMDtpIDwgeG1sLmNoaWxkcmVuLmxlbmd0aDtpKyspIHtcbiAgICAgICAgICAgICAgICAgIHZhciBjaGlsZCA9IHhtbC5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgICAgICAgIHR4dCArPSBcIjxsaT5cIjtcbiAgICAgICAgICAgICAgICAgIHR4dCArPSB0aGlzLnJlbmRlck5vZGUoY2hpbGQpO1xuICAgICAgICAgICAgICAgICAgdHh0ICs9IFwiPC9saT5cIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgdHh0ICs9IFwiXFxuPC91bD5cXG5cIjtcbiAgICAgICAgICByZXR1cm4gdHh0O1xuICB9LFxuXG4gIHJlbmRlckRpZmY6IGZ1bmN0aW9uKCl7XG4gICAgdmFyIHhtbCA9ICQodGhpcy5zY2VuZSlbMF07XG4gICAgdmFyIGh0bWwgPSB0aGlzLnJlbmRlck5vZGUoeG1sKTtcbiAgICAkKFwiI3RhcmdldFwiKS5odG1sKGh0bWwpO1xuICB9XG4gIFxuICBcbi8qXG4gICAgICAgIHZhciBzY2VuZSAgPSBudWxsO1xuICAgICAgICB2YXIgc2hhZG93ID0gbnVsbDtcblxuICAgICAgICB2YXIgcmVuZGVyTm9kZSA9IGZ1bmN0aW9uKHhtbCkge1xuICAgICAgICAgICAgICAgIGlmICgheG1sLmxvY2FsTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiPz8/XCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciB0eHQgPSB4bWwubG9jYWxOYW1lO1xuICAgICAgICAgICAgICAgIHR4dCArPSBcIlxcbjx1bD5cXG5cIjtcbiAgICAgICAgICAgICAgICBmb3IodmFyIGkgPSAwO2kgPCB4bWwuYXR0cmlidXRlcy5sZW5ndGg7aSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaXRlbSA9IHhtbC5hdHRyaWJ1dGVzLml0ZW0oaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eHQgKz0gXCI8bGk+XCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eHQgKz0gaXRlbS5uYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHh0ICs9IFwiID0gXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eHQgKz0gXCJcXFwiXCIgKyBpdGVtLnZhbHVlICsgXCJcXFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eHQgKz0gXCI8L2xpPlwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IodmFyIGkgPSAwO2kgPCB4bWwuY2hpbGRyZW4ubGVuZ3RoO2krKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNoaWxkID0geG1sLmNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHh0ICs9IFwiPGxpPlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHh0ICs9IHJlbmRlck5vZGUoY2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHh0ICs9IFwiPC9saT5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdHh0ICs9IFwiXFxuPC91bD5cXG5cIjtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHh0O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB2YXIgcmVuZGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgIHZhciB4bWwgPSAkKHNjZW5lKVswXTtcbiAgICAgICAgICAgdmFyIGh0bWwgPSByZW5kZXJOb2RlKHhtbCk7XG4gICAgICAgICAgICQoXCIjdGFyZ2V0XCIpLmh0bWwoaHRtbCk7XG4gICAgICAgIH07XG5cbiovICBcbiAgXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBTZXJ2ZXJVdGlscygpO1xuXG4iXX0=
