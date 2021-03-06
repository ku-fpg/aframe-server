/* Reload the aframe dynamically, as needed. Put the scene back to the server, as needed.
 */

var diff = require("diff");

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
      this.edit = true;
//      $("a-scene").attr("debug","true")
      console.log("edit key (s+cntl+alt) enabled");
      // (from aframe's inspector.js)
      this.onKeydown = this.onKeydown.bind(this);
      window.addEventListener('keydown', this.onKeydown);
      this.pushScene(); // And also push back the initial version of the scene to the shadow AFrame Object.
    }
    if (params.get("load") != undefined) {
      this.load = true;
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
    $.get("/REST/shadow", function(o) {
            console.log("/REST/shadow",o);
            self.shadow = o;
            self.renderDiff();
    });
  },

  renderNode: function(orig,saved) {
    var self = this;
          if (!orig || !orig.localName 
            || !saved || !saved.localName 
            || (orig.localName != saved.localName)) {
//            console.log("mismatch",orig,saved);
            return "-";
          }

          var listOf = function(o) {
            var res = [];
            for(var i = 0;i < o.length;i++) {
              res.push(o.item(i));
            }
            return res;
          }

          var txt = orig.localName;

          var origAttr = listOf(orig.attributes).map(function(o) { return o.name; }).join(' ');
          var savedAttr = listOf(saved.attributes).map(function(o) { return o.name; }).join(' ');
            
          var diffAttr = diff.diffWords(origAttr,savedAttr);  

          txt += "\n<ul>\n";

          var origCount = 0;
          var savedCount = 0;

          function showAttr(str) {
            if (str == "") { 
                return "";
              }
              return ' = "' + str + '"';
          }

          diffAttr.forEach(function(part){
            part.value.trim().split(" ").forEach(function(word){
              txt += "<li>";
              if(part.added) {
                txt += "<font color=\"green\">";
              } else if (part.removed) {
                txt += "<font color=\"red\">";                
              }
              txt += word;
              if (part.added) {
                txt += showAttr(saved.attributes.item(savedCount++).value);
              } else if (part.removed) {
                txt += showAttr(orig.attributes.item(origCount++).value);
              } else {
                if (saved.attributes.item(savedCount).value == orig.attributes.item(origCount).value) {
                  txt += showAttr(orig.attributes.item(origCount++).value);
                  savedCount++;
                } else {
                  txt += ' = <font color="green">"' + saved.attributes.item(savedCount++).value + '"</font>' +
                       '  // <font color="red">"'   + orig.attributes.item(origCount++).value   + '"</font>';
                }
              }
              if(part.added || part.removed) {
                txt += "</font>";                
              }
              txt += "</li>";
            });
          });

          var origChidren   = listOf(orig.children).map(function(o) { return o.localName; }).join(' ');
          var savedChildren = listOf(saved.children).map(function(o) { return o.localName; }).join(' ');
          var diffChildren  = diff.diffWords(origChidren,savedChildren);  

          var origCount = 0;
          var savedCount = 0;
          diffChildren.forEach(function(part){
            part.value.trim().split(" ").forEach(function(word){
              if (word == "") {
                return;
              }  
              txt += "<li>";
              if(part.added) {
                txt += "<font color=\"green\">";
              } else if (part.removed) {
                txt += "<font color=\"red\">";                
              }
              if(part.added) {
                var subSaved = saved.children.item(savedCount++);
                txt += self.renderNode(subSaved,subSaved);
              } else if (part.removed) {
                var subOrig = orig.children.item(origCount++);
                txt += self.renderNode(subOrig,subOrig);
              } else {
                var subOrig = orig.children.item(origCount++);
                var subSaved = saved.children.item(savedCount++);
                txt += self.renderNode(subOrig,subSaved);
              }
              if(part.added || part.removed) {
                txt += "</font>";                
              }

              txt += "</li>";
            });
          });

//          debugging = { orig: orig, saved: saved, listOf: listOf, origAttr:origAttr, savedAttr: savedAttr,
//                       diffAttr: diffAttr };

          txt += "\n</ul>\n";
          return txt;
  },

  // Rewrite XML to un-expand the a-frame changes.
  normalizeSaved: function(xml) {
    console.log(xml.localName);
    if (xml.localName == "canvas") {
        return false;
    }

    if (xml.attributes.getNamedItem("aframe-injected")) {
      console.log("injected...");
      return false;
    }

    ["inspector","vr-mode-ui","keyboard-shortcuts","debug","canvas","class"]
    .forEach(function(item) {
            if (xml.attributes.getNamedItem(item)) {
                xml.attributes.removeNamedItem(item);
            }
    });

    for(var i = 0;i < xml.children.length;i++) {
      var res = this.normalizeSaved(xml.children.item(i));
      if (!res) {
          xml.removeChild(xml.children.item(i));
          i--; // back up a step, because you've just deleted                       
               // a node                                                            
        }
      }
      return true;
  },

  renderDiff: function(){
    if (!this.scene) {
      $("#target").html("original scene not readable");
    }
    var orig = $(this.scene)[0];
    if (!this.shadow) {
      $("#target").html("shadow scene not readable");
    }
    var saved = $(this.shadow)[0];
    if (saved.localName == "div") {
      $("#target").html("shadow scene not saved (yet)");      
    }

    this.normalizeSaved(saved);

    debugging = { orig: orig, saved: saved };

    var html = this.renderNode(orig,saved);
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

