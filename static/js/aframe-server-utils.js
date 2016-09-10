(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.aframeServerUtils = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
            console.log("mismatch",orig,saved);
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
          diffAttr.forEach(function(part){
            part.value.trim().split(" ").forEach(function(word){
              txt += "<li>";
              if(part.added) {
                txt += "<font color=\"green\">";
              } else if (part.removed) {
                txt += "<font color=\"red\">";                
              }
              txt += word;
              txt += " = ";
              if (part.added) {
                txt += '"' + saved.attributes.item(savedCount++).value + '"';
              } else if (part.removed) {
                txt += '"' + orig.attributes.item(origCount++).value + '"';
              } else {
                if (saved.attributes.item(savedCount).value == orig.attributes.item(origCount).value) {
                  txt += '"' + orig.attributes.item(origCount++).value + '"';
                  savedCount++;
                } else {
                  txt += '<font color="green">"' + saved.attributes.item(savedCount++).value + '"</font>' +
                     ' // <font color="red">"'   + orig.attributes.item(origCount++).value  + '"</font>';
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

          debugging = { orig: orig, saved: saved, listOf: listOf, origAttr:origAttr, savedAttr: savedAttr,
                       diffAttr: diffAttr };

          txt += "\n</ul>\n";
          return txt;
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


},{"diff":11}],2:[function(require,module,exports){
/*istanbul ignore start*/"use strict";

exports.__esModule = true;
exports. /*istanbul ignore end*/convertChangesToDMP = convertChangesToDMP;
// See: http://code.google.com/p/google-diff-match-patch/wiki/API
function convertChangesToDMP(changes) {
  var ret = [],
      change = /*istanbul ignore start*/void 0 /*istanbul ignore end*/,
      operation = /*istanbul ignore start*/void 0 /*istanbul ignore end*/;
  for (var i = 0; i < changes.length; i++) {
    change = changes[i];
    if (change.added) {
      operation = 1;
    } else if (change.removed) {
      operation = -1;
    } else {
      operation = 0;
    }

    ret.push([operation, change.value]);
  }
  return ret;
}


},{}],3:[function(require,module,exports){
/*istanbul ignore start*/'use strict';

exports.__esModule = true;
exports. /*istanbul ignore end*/convertChangesToXML = convertChangesToXML;
function convertChangesToXML(changes) {
  var ret = [];
  for (var i = 0; i < changes.length; i++) {
    var change = changes[i];
    if (change.added) {
      ret.push('<ins>');
    } else if (change.removed) {
      ret.push('<del>');
    }

    ret.push(escapeHTML(change.value));

    if (change.added) {
      ret.push('</ins>');
    } else if (change.removed) {
      ret.push('</del>');
    }
  }
  return ret.join('');
}

function escapeHTML(s) {
  var n = s;
  n = n.replace(/&/g, '&amp;');
  n = n.replace(/</g, '&lt;');
  n = n.replace(/>/g, '&gt;');
  n = n.replace(/"/g, '&quot;');

  return n;
}


},{}],4:[function(require,module,exports){
/*istanbul ignore start*/'use strict';

exports.__esModule = true;
exports.default = /*istanbul ignore end*/Diff;
function Diff() {}

Diff.prototype = { /*istanbul ignore start*/
  /*istanbul ignore end*/diff: function diff(oldString, newString) {
    /*istanbul ignore start*/var /*istanbul ignore end*/options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

    var callback = options.callback;
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    this.options = options;

    var self = this;

    function done(value) {
      if (callback) {
        setTimeout(function () {
          callback(undefined, value);
        }, 0);
        return true;
      } else {
        return value;
      }
    }

    // Allow subclasses to massage the input prior to running
    oldString = this.castInput(oldString);
    newString = this.castInput(newString);

    oldString = this.removeEmpty(this.tokenize(oldString));
    newString = this.removeEmpty(this.tokenize(newString));

    var newLen = newString.length,
        oldLen = oldString.length;
    var editLength = 1;
    var maxEditLength = newLen + oldLen;
    var bestPath = [{ newPos: -1, components: [] }];

    // Seed editLength = 0, i.e. the content starts with the same values
    var oldPos = this.extractCommon(bestPath[0], newString, oldString, 0);
    if (bestPath[0].newPos + 1 >= newLen && oldPos + 1 >= oldLen) {
      // Identity per the equality and tokenizer
      return done([{ value: newString.join(''), count: newString.length }]);
    }

    // Main worker method. checks all permutations of a given edit length for acceptance.
    function execEditLength() {
      for (var diagonalPath = -1 * editLength; diagonalPath <= editLength; diagonalPath += 2) {
        var basePath = /*istanbul ignore start*/void 0 /*istanbul ignore end*/;
        var addPath = bestPath[diagonalPath - 1],
            removePath = bestPath[diagonalPath + 1],
            _oldPos = (removePath ? removePath.newPos : 0) - diagonalPath;
        if (addPath) {
          // No one else is going to attempt to use this value, clear it
          bestPath[diagonalPath - 1] = undefined;
        }

        var canAdd = addPath && addPath.newPos + 1 < newLen,
            canRemove = removePath && 0 <= _oldPos && _oldPos < oldLen;
        if (!canAdd && !canRemove) {
          // If this path is a terminal then prune
          bestPath[diagonalPath] = undefined;
          continue;
        }

        // Select the diagonal that we want to branch from. We select the prior
        // path whose position in the new string is the farthest from the origin
        // and does not pass the bounds of the diff graph
        if (!canAdd || canRemove && addPath.newPos < removePath.newPos) {
          basePath = clonePath(removePath);
          self.pushComponent(basePath.components, undefined, true);
        } else {
          basePath = addPath; // No need to clone, we've pulled it from the list
          basePath.newPos++;
          self.pushComponent(basePath.components, true, undefined);
        }

        _oldPos = self.extractCommon(basePath, newString, oldString, diagonalPath);

        // If we have hit the end of both strings, then we are done
        if (basePath.newPos + 1 >= newLen && _oldPos + 1 >= oldLen) {
          return done(buildValues(self, basePath.components, newString, oldString, self.useLongestToken));
        } else {
          // Otherwise track this path as a potential candidate and continue.
          bestPath[diagonalPath] = basePath;
        }
      }

      editLength++;
    }

    // Performs the length of edit iteration. Is a bit fugly as this has to support the
    // sync and async mode which is never fun. Loops over execEditLength until a value
    // is produced.
    if (callback) {
      (function exec() {
        setTimeout(function () {
          // This should not happen, but we want to be safe.
          /* istanbul ignore next */
          if (editLength > maxEditLength) {
            return callback();
          }

          if (!execEditLength()) {
            exec();
          }
        }, 0);
      })();
    } else {
      while (editLength <= maxEditLength) {
        var ret = execEditLength();
        if (ret) {
          return ret;
        }
      }
    }
  },
  /*istanbul ignore start*/ /*istanbul ignore end*/pushComponent: function pushComponent(components, added, removed) {
    var last = components[components.length - 1];
    if (last && last.added === added && last.removed === removed) {
      // We need to clone here as the component clone operation is just
      // as shallow array clone
      components[components.length - 1] = { count: last.count + 1, added: added, removed: removed };
    } else {
      components.push({ count: 1, added: added, removed: removed });
    }
  },
  /*istanbul ignore start*/ /*istanbul ignore end*/extractCommon: function extractCommon(basePath, newString, oldString, diagonalPath) {
    var newLen = newString.length,
        oldLen = oldString.length,
        newPos = basePath.newPos,
        oldPos = newPos - diagonalPath,
        commonCount = 0;
    while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(newString[newPos + 1], oldString[oldPos + 1])) {
      newPos++;
      oldPos++;
      commonCount++;
    }

    if (commonCount) {
      basePath.components.push({ count: commonCount });
    }

    basePath.newPos = newPos;
    return oldPos;
  },
  /*istanbul ignore start*/ /*istanbul ignore end*/equals: function equals(left, right) {
    return left === right;
  },
  /*istanbul ignore start*/ /*istanbul ignore end*/removeEmpty: function removeEmpty(array) {
    var ret = [];
    for (var i = 0; i < array.length; i++) {
      if (array[i]) {
        ret.push(array[i]);
      }
    }
    return ret;
  },
  /*istanbul ignore start*/ /*istanbul ignore end*/castInput: function castInput(value) {
    return value;
  },
  /*istanbul ignore start*/ /*istanbul ignore end*/tokenize: function tokenize(value) {
    return value.split('');
  }
};

function buildValues(diff, components, newString, oldString, useLongestToken) {
  var componentPos = 0,
      componentLen = components.length,
      newPos = 0,
      oldPos = 0;

  for (; componentPos < componentLen; componentPos++) {
    var component = components[componentPos];
    if (!component.removed) {
      if (!component.added && useLongestToken) {
        var value = newString.slice(newPos, newPos + component.count);
        value = value.map(function (value, i) {
          var oldValue = oldString[oldPos + i];
          return oldValue.length > value.length ? oldValue : value;
        });

        component.value = value.join('');
      } else {
        component.value = newString.slice(newPos, newPos + component.count).join('');
      }
      newPos += component.count;

      // Common case
      if (!component.added) {
        oldPos += component.count;
      }
    } else {
      component.value = oldString.slice(oldPos, oldPos + component.count).join('');
      oldPos += component.count;

      // Reverse add and remove so removes are output first to match common convention
      // The diffing algorithm is tied to add then remove output and this is the simplest
      // route to get the desired output with minimal overhead.
      if (componentPos && components[componentPos - 1].added) {
        var tmp = components[componentPos - 1];
        components[componentPos - 1] = components[componentPos];
        components[componentPos] = tmp;
      }
    }
  }

  // Special case handle for when one terminal is ignored. For this case we merge the
  // terminal into the prior string and drop the change.
  var lastComponent = components[componentLen - 1];
  if (componentLen > 1 && (lastComponent.added || lastComponent.removed) && diff.equals('', lastComponent.value)) {
    components[componentLen - 2].value += lastComponent.value;
    components.pop();
  }

  return components;
}

function clonePath(path) {
  return { newPos: path.newPos, components: path.components.slice(0) };
}


},{}],5:[function(require,module,exports){
/*istanbul ignore start*/'use strict';

exports.__esModule = true;
exports.characterDiff = undefined;
exports. /*istanbul ignore end*/diffChars = diffChars;

var /*istanbul ignore start*/_base = require('./base') /*istanbul ignore end*/;

/*istanbul ignore start*/
var _base2 = _interopRequireDefault(_base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*istanbul ignore end*/var characterDiff = /*istanbul ignore start*/exports. /*istanbul ignore end*/characterDiff = new /*istanbul ignore start*/_base2.default() /*istanbul ignore end*/;
function diffChars(oldStr, newStr, callback) {
  return characterDiff.diff(oldStr, newStr, callback);
}


},{"./base":4}],6:[function(require,module,exports){
/*istanbul ignore start*/'use strict';

exports.__esModule = true;
exports.cssDiff = undefined;
exports. /*istanbul ignore end*/diffCss = diffCss;

var /*istanbul ignore start*/_base = require('./base') /*istanbul ignore end*/;

/*istanbul ignore start*/
var _base2 = _interopRequireDefault(_base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*istanbul ignore end*/var cssDiff = /*istanbul ignore start*/exports. /*istanbul ignore end*/cssDiff = new /*istanbul ignore start*/_base2.default() /*istanbul ignore end*/;
cssDiff.tokenize = function (value) {
  return value.split(/([{}:;,]|\s+)/);
};

function diffCss(oldStr, newStr, callback) {
  return cssDiff.diff(oldStr, newStr, callback);
}


},{"./base":4}],7:[function(require,module,exports){
/*istanbul ignore start*/'use strict';

exports.__esModule = true;
exports.jsonDiff = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

exports. /*istanbul ignore end*/diffJson = diffJson;
/*istanbul ignore start*/exports. /*istanbul ignore end*/canonicalize = canonicalize;

var /*istanbul ignore start*/_base = require('./base') /*istanbul ignore end*/;

/*istanbul ignore start*/
var _base2 = _interopRequireDefault(_base);

/*istanbul ignore end*/
var /*istanbul ignore start*/_line = require('./line') /*istanbul ignore end*/;

/*istanbul ignore start*/
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*istanbul ignore end*/

var objectPrototypeToString = Object.prototype.toString;

var jsonDiff = /*istanbul ignore start*/exports. /*istanbul ignore end*/jsonDiff = new /*istanbul ignore start*/_base2.default() /*istanbul ignore end*/;
// Discriminate between two lines of pretty-printed, serialized JSON where one of them has a
// dangling comma and the other doesn't. Turns out including the dangling comma yields the nicest output:
jsonDiff.useLongestToken = true;

jsonDiff.tokenize = /*istanbul ignore start*/_line.lineDiff. /*istanbul ignore end*/tokenize;
jsonDiff.castInput = function (value) {
  return typeof value === 'string' ? value : JSON.stringify(canonicalize(value), undefined, '  ');
};
jsonDiff.equals = function (left, right) {
  return (/*istanbul ignore start*/_base2.default. /*istanbul ignore end*/prototype.equals(left.replace(/,([\r\n])/g, '$1'), right.replace(/,([\r\n])/g, '$1'))
  );
};

function diffJson(oldObj, newObj, callback) {
  return jsonDiff.diff(oldObj, newObj, callback);
}

// This function handles the presence of circular references by bailing out when encountering an
// object that is already on the "stack" of items being processed.
function canonicalize(obj, stack, replacementStack) {
  stack = stack || [];
  replacementStack = replacementStack || [];

  var i = /*istanbul ignore start*/void 0 /*istanbul ignore end*/;

  for (i = 0; i < stack.length; i += 1) {
    if (stack[i] === obj) {
      return replacementStack[i];
    }
  }

  var canonicalizedObj = /*istanbul ignore start*/void 0 /*istanbul ignore end*/;

  if ('[object Array]' === objectPrototypeToString.call(obj)) {
    stack.push(obj);
    canonicalizedObj = new Array(obj.length);
    replacementStack.push(canonicalizedObj);
    for (i = 0; i < obj.length; i += 1) {
      canonicalizedObj[i] = canonicalize(obj[i], stack, replacementStack);
    }
    stack.pop();
    replacementStack.pop();
    return canonicalizedObj;
  }

  if (obj && obj.toJSON) {
    obj = obj.toJSON();
  }

  if ( /*istanbul ignore start*/(typeof /*istanbul ignore end*/obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object' && obj !== null) {
    stack.push(obj);
    canonicalizedObj = {};
    replacementStack.push(canonicalizedObj);
    var sortedKeys = [],
        key = /*istanbul ignore start*/void 0 /*istanbul ignore end*/;
    for (key in obj) {
      /* istanbul ignore else */
      if (obj.hasOwnProperty(key)) {
        sortedKeys.push(key);
      }
    }
    sortedKeys.sort();
    for (i = 0; i < sortedKeys.length; i += 1) {
      key = sortedKeys[i];
      canonicalizedObj[key] = canonicalize(obj[key], stack, replacementStack);
    }
    stack.pop();
    replacementStack.pop();
  } else {
    canonicalizedObj = obj;
  }
  return canonicalizedObj;
}


},{"./base":4,"./line":8}],8:[function(require,module,exports){
/*istanbul ignore start*/'use strict';

exports.__esModule = true;
exports.lineDiff = undefined;
exports. /*istanbul ignore end*/diffLines = diffLines;
/*istanbul ignore start*/exports. /*istanbul ignore end*/diffTrimmedLines = diffTrimmedLines;

var /*istanbul ignore start*/_base = require('./base') /*istanbul ignore end*/;

/*istanbul ignore start*/
var _base2 = _interopRequireDefault(_base);

/*istanbul ignore end*/
var /*istanbul ignore start*/_params = require('../util/params') /*istanbul ignore end*/;

/*istanbul ignore start*/
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*istanbul ignore end*/var lineDiff = /*istanbul ignore start*/exports. /*istanbul ignore end*/lineDiff = new /*istanbul ignore start*/_base2.default() /*istanbul ignore end*/;
lineDiff.tokenize = function (value) {
  var retLines = [],
      linesAndNewlines = value.split(/(\n|\r\n)/);

  // Ignore the final empty token that occurs if the string ends with a new line
  if (!linesAndNewlines[linesAndNewlines.length - 1]) {
    linesAndNewlines.pop();
  }

  // Merge the content and line separators into single tokens
  for (var i = 0; i < linesAndNewlines.length; i++) {
    var line = linesAndNewlines[i];

    if (i % 2 && !this.options.newlineIsToken) {
      retLines[retLines.length - 1] += line;
    } else {
      if (this.options.ignoreWhitespace) {
        line = line.trim();
      }
      retLines.push(line);
    }
  }

  return retLines;
};

function diffLines(oldStr, newStr, callback) {
  return lineDiff.diff(oldStr, newStr, callback);
}
function diffTrimmedLines(oldStr, newStr, callback) {
  var options = /*istanbul ignore start*/(0, _params.generateOptions) /*istanbul ignore end*/(callback, { ignoreWhitespace: true });
  return lineDiff.diff(oldStr, newStr, options);
}


},{"../util/params":16,"./base":4}],9:[function(require,module,exports){
/*istanbul ignore start*/'use strict';

exports.__esModule = true;
exports.sentenceDiff = undefined;
exports. /*istanbul ignore end*/diffSentences = diffSentences;

var /*istanbul ignore start*/_base = require('./base') /*istanbul ignore end*/;

/*istanbul ignore start*/
var _base2 = _interopRequireDefault(_base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*istanbul ignore end*/var sentenceDiff = /*istanbul ignore start*/exports. /*istanbul ignore end*/sentenceDiff = new /*istanbul ignore start*/_base2.default() /*istanbul ignore end*/;
sentenceDiff.tokenize = function (value) {
  return value.split(/(\S.+?[.!?])(?=\s+|$)/);
};

function diffSentences(oldStr, newStr, callback) {
  return sentenceDiff.diff(oldStr, newStr, callback);
}


},{"./base":4}],10:[function(require,module,exports){
/*istanbul ignore start*/'use strict';

exports.__esModule = true;
exports.wordDiff = undefined;
exports. /*istanbul ignore end*/diffWords = diffWords;
/*istanbul ignore start*/exports. /*istanbul ignore end*/diffWordsWithSpace = diffWordsWithSpace;

var /*istanbul ignore start*/_base = require('./base') /*istanbul ignore end*/;

/*istanbul ignore start*/
var _base2 = _interopRequireDefault(_base);

/*istanbul ignore end*/
var /*istanbul ignore start*/_params = require('../util/params') /*istanbul ignore end*/;

/*istanbul ignore start*/
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*istanbul ignore end*/

// Based on https://en.wikipedia.org/wiki/Latin_script_in_Unicode
//
// Ranges and exceptions:
// Latin-1 Supplement, 0080–00FF
//  - U+00D7  × Multiplication sign
//  - U+00F7  ÷ Division sign
// Latin Extended-A, 0100–017F
// Latin Extended-B, 0180–024F
// IPA Extensions, 0250–02AF
// Spacing Modifier Letters, 02B0–02FF
//  - U+02C7  ˇ &#711;  Caron
//  - U+02D8  ˘ &#728;  Breve
//  - U+02D9  ˙ &#729;  Dot Above
//  - U+02DA  ˚ &#730;  Ring Above
//  - U+02DB  ˛ &#731;  Ogonek
//  - U+02DC  ˜ &#732;  Small Tilde
//  - U+02DD  ˝ &#733;  Double Acute Accent
// Latin Extended Additional, 1E00–1EFF
var extendedWordChars = /^[A-Za-z\xC0-\u02C6\u02C8-\u02D7\u02DE-\u02FF\u1E00-\u1EFF]+$/;

var reWhitespace = /\S/;

var wordDiff = /*istanbul ignore start*/exports. /*istanbul ignore end*/wordDiff = new /*istanbul ignore start*/_base2.default() /*istanbul ignore end*/;
wordDiff.equals = function (left, right) {
  return left === right || this.options.ignoreWhitespace && !reWhitespace.test(left) && !reWhitespace.test(right);
};
wordDiff.tokenize = function (value) {
  var tokens = value.split(/(\s+|\b)/);

  // Join the boundary splits that we do not consider to be boundaries. This is primarily the extended Latin character set.
  for (var i = 0; i < tokens.length - 1; i++) {
    // If we have an empty string in the next field and we have only word chars before and after, merge
    if (!tokens[i + 1] && tokens[i + 2] && extendedWordChars.test(tokens[i]) && extendedWordChars.test(tokens[i + 2])) {
      tokens[i] += tokens[i + 2];
      tokens.splice(i + 1, 2);
      i--;
    }
  }

  return tokens;
};

function diffWords(oldStr, newStr, callback) {
  var options = /*istanbul ignore start*/(0, _params.generateOptions) /*istanbul ignore end*/(callback, { ignoreWhitespace: true });
  return wordDiff.diff(oldStr, newStr, options);
}
function diffWordsWithSpace(oldStr, newStr, callback) {
  return wordDiff.diff(oldStr, newStr, callback);
}


},{"../util/params":16,"./base":4}],11:[function(require,module,exports){
/*istanbul ignore start*/'use strict';

exports.__esModule = true;
exports.canonicalize = exports.convertChangesToXML = exports.convertChangesToDMP = exports.parsePatch = exports.applyPatches = exports.applyPatch = exports.createPatch = exports.createTwoFilesPatch = exports.structuredPatch = exports.diffJson = exports.diffCss = exports.diffSentences = exports.diffTrimmedLines = exports.diffLines = exports.diffWordsWithSpace = exports.diffWords = exports.diffChars = exports.Diff = undefined;
/*istanbul ignore end*/
var /*istanbul ignore start*/_base = require('./diff/base') /*istanbul ignore end*/;

/*istanbul ignore start*/
var _base2 = _interopRequireDefault(_base);

/*istanbul ignore end*/
var /*istanbul ignore start*/_character = require('./diff/character') /*istanbul ignore end*/;

var /*istanbul ignore start*/_word = require('./diff/word') /*istanbul ignore end*/;

var /*istanbul ignore start*/_line = require('./diff/line') /*istanbul ignore end*/;

var /*istanbul ignore start*/_sentence = require('./diff/sentence') /*istanbul ignore end*/;

var /*istanbul ignore start*/_css = require('./diff/css') /*istanbul ignore end*/;

var /*istanbul ignore start*/_json = require('./diff/json') /*istanbul ignore end*/;

var /*istanbul ignore start*/_apply = require('./patch/apply') /*istanbul ignore end*/;

var /*istanbul ignore start*/_parse = require('./patch/parse') /*istanbul ignore end*/;

var /*istanbul ignore start*/_create = require('./patch/create') /*istanbul ignore end*/;

var /*istanbul ignore start*/_dmp = require('./convert/dmp') /*istanbul ignore end*/;

var /*istanbul ignore start*/_xml = require('./convert/xml') /*istanbul ignore end*/;

/*istanbul ignore start*/
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* See LICENSE file for terms of use */

/*
 * Text diff implementation.
 *
 * This library supports the following APIS:
 * JsDiff.diffChars: Character by character diff
 * JsDiff.diffWords: Word (as defined by \b regex) diff which ignores whitespace
 * JsDiff.diffLines: Line based diff
 *
 * JsDiff.diffCss: Diff targeted at CSS content
 *
 * These methods are based on the implementation proposed in
 * "An O(ND) Difference Algorithm and its Variations" (Myers, 1986).
 * http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.4.6927
 */
exports. /*istanbul ignore end*/Diff = _base2.default;
/*istanbul ignore start*/exports. /*istanbul ignore end*/diffChars = _character.diffChars;
/*istanbul ignore start*/exports. /*istanbul ignore end*/diffWords = _word.diffWords;
/*istanbul ignore start*/exports. /*istanbul ignore end*/diffWordsWithSpace = _word.diffWordsWithSpace;
/*istanbul ignore start*/exports. /*istanbul ignore end*/diffLines = _line.diffLines;
/*istanbul ignore start*/exports. /*istanbul ignore end*/diffTrimmedLines = _line.diffTrimmedLines;
/*istanbul ignore start*/exports. /*istanbul ignore end*/diffSentences = _sentence.diffSentences;
/*istanbul ignore start*/exports. /*istanbul ignore end*/diffCss = _css.diffCss;
/*istanbul ignore start*/exports. /*istanbul ignore end*/diffJson = _json.diffJson;
/*istanbul ignore start*/exports. /*istanbul ignore end*/structuredPatch = _create.structuredPatch;
/*istanbul ignore start*/exports. /*istanbul ignore end*/createTwoFilesPatch = _create.createTwoFilesPatch;
/*istanbul ignore start*/exports. /*istanbul ignore end*/createPatch = _create.createPatch;
/*istanbul ignore start*/exports. /*istanbul ignore end*/applyPatch = _apply.applyPatch;
/*istanbul ignore start*/exports. /*istanbul ignore end*/applyPatches = _apply.applyPatches;
/*istanbul ignore start*/exports. /*istanbul ignore end*/parsePatch = _parse.parsePatch;
/*istanbul ignore start*/exports. /*istanbul ignore end*/convertChangesToDMP = _dmp.convertChangesToDMP;
/*istanbul ignore start*/exports. /*istanbul ignore end*/convertChangesToXML = _xml.convertChangesToXML;
/*istanbul ignore start*/exports. /*istanbul ignore end*/canonicalize = _json.canonicalize;


},{"./convert/dmp":2,"./convert/xml":3,"./diff/base":4,"./diff/character":5,"./diff/css":6,"./diff/json":7,"./diff/line":8,"./diff/sentence":9,"./diff/word":10,"./patch/apply":12,"./patch/create":13,"./patch/parse":14}],12:[function(require,module,exports){
/*istanbul ignore start*/'use strict';

exports.__esModule = true;
exports. /*istanbul ignore end*/applyPatch = applyPatch;
/*istanbul ignore start*/exports. /*istanbul ignore end*/applyPatches = applyPatches;

var /*istanbul ignore start*/_parse = require('./parse') /*istanbul ignore end*/;

var /*istanbul ignore start*/_distanceIterator = require('../util/distance-iterator') /*istanbul ignore end*/;

/*istanbul ignore start*/
var _distanceIterator2 = _interopRequireDefault(_distanceIterator);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*istanbul ignore end*/function applyPatch(source, uniDiff) {
  /*istanbul ignore start*/var /*istanbul ignore end*/options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  if (typeof uniDiff === 'string') {
    uniDiff = /*istanbul ignore start*/(0, _parse.parsePatch) /*istanbul ignore end*/(uniDiff);
  }

  if (Array.isArray(uniDiff)) {
    if (uniDiff.length > 1) {
      throw new Error('applyPatch only works with a single input.');
    }

    uniDiff = uniDiff[0];
  }

  // Apply the diff to the input
  var lines = source.split('\n'),
      hunks = uniDiff.hunks,
      compareLine = options.compareLine || function (lineNumber, line, operation, patchContent) /*istanbul ignore start*/{
    return (/*istanbul ignore end*/line === patchContent
    );
  },
      errorCount = 0,
      fuzzFactor = options.fuzzFactor || 0,
      minLine = 0,
      offset = 0,
      removeEOFNL = /*istanbul ignore start*/void 0 /*istanbul ignore end*/,
      addEOFNL = /*istanbul ignore start*/void 0 /*istanbul ignore end*/;

  /**
   * Checks if the hunk exactly fits on the provided location
   */
  function hunkFits(hunk, toPos) {
    for (var j = 0; j < hunk.lines.length; j++) {
      var line = hunk.lines[j],
          operation = line[0],
          content = line.substr(1);

      if (operation === ' ' || operation === '-') {
        // Context sanity check
        if (!compareLine(toPos + 1, lines[toPos], operation, content)) {
          errorCount++;

          if (errorCount > fuzzFactor) {
            return false;
          }
        }
        toPos++;
      }
    }

    return true;
  }

  // Search best fit offsets for each hunk based on the previous ones
  for (var i = 0; i < hunks.length; i++) {
    var hunk = hunks[i],
        maxLine = lines.length - hunk.oldLines,
        localOffset = 0,
        toPos = offset + hunk.oldStart - 1;

    var iterator = /*istanbul ignore start*/(0, _distanceIterator2.default) /*istanbul ignore end*/(toPos, minLine, maxLine);

    for (; localOffset !== undefined; localOffset = iterator()) {
      if (hunkFits(hunk, toPos + localOffset)) {
        hunk.offset = offset += localOffset;
        break;
      }
    }

    if (localOffset === undefined) {
      return false;
    }

    // Set lower text limit to end of the current hunk, so next ones don't try
    // to fit over already patched text
    minLine = hunk.offset + hunk.oldStart + hunk.oldLines;
  }

  // Apply patch hunks
  for (var _i = 0; _i < hunks.length; _i++) {
    var _hunk = hunks[_i],
        _toPos = _hunk.offset + _hunk.newStart - 1;
    if (_hunk.newLines == 0) {
      _toPos++;
    }

    for (var j = 0; j < _hunk.lines.length; j++) {
      var line = _hunk.lines[j],
          operation = line[0],
          content = line.substr(1);

      if (operation === ' ') {
        _toPos++;
      } else if (operation === '-') {
        lines.splice(_toPos, 1);
        /* istanbul ignore else */
      } else if (operation === '+') {
          lines.splice(_toPos, 0, content);
          _toPos++;
        } else if (operation === '\\') {
          var previousOperation = _hunk.lines[j - 1] ? _hunk.lines[j - 1][0] : null;
          if (previousOperation === '+') {
            removeEOFNL = true;
          } else if (previousOperation === '-') {
            addEOFNL = true;
          }
        }
    }
  }

  // Handle EOFNL insertion/removal
  if (removeEOFNL) {
    while (!lines[lines.length - 1]) {
      lines.pop();
    }
  } else if (addEOFNL) {
    lines.push('');
  }
  return lines.join('\n');
}

// Wrapper that supports multiple file patches via callbacks.
function applyPatches(uniDiff, options) {
  if (typeof uniDiff === 'string') {
    uniDiff = /*istanbul ignore start*/(0, _parse.parsePatch) /*istanbul ignore end*/(uniDiff);
  }

  var currentIndex = 0;
  function processIndex() {
    var index = uniDiff[currentIndex++];
    if (!index) {
      return options.complete();
    }

    options.loadFile(index, function (err, data) {
      if (err) {
        return options.complete(err);
      }

      var updatedContent = applyPatch(data, index, options);
      options.patched(index, updatedContent, function (err) {
        if (err) {
          return options.complete(err);
        }

        processIndex();
      });
    });
  }
  processIndex();
}


},{"../util/distance-iterator":15,"./parse":14}],13:[function(require,module,exports){
/*istanbul ignore start*/'use strict';

exports.__esModule = true;
exports. /*istanbul ignore end*/structuredPatch = structuredPatch;
/*istanbul ignore start*/exports. /*istanbul ignore end*/createTwoFilesPatch = createTwoFilesPatch;
/*istanbul ignore start*/exports. /*istanbul ignore end*/createPatch = createPatch;

var /*istanbul ignore start*/_line = require('../diff/line') /*istanbul ignore end*/;

/*istanbul ignore start*/
function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/*istanbul ignore end*/function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
  if (!options) {
    options = { context: 4 };
  }

  var diff = /*istanbul ignore start*/(0, _line.diffLines) /*istanbul ignore end*/(oldStr, newStr);
  diff.push({ value: '', lines: [] }); // Append an empty value to make cleanup easier

  function contextLines(lines) {
    return lines.map(function (entry) {
      return ' ' + entry;
    });
  }

  var hunks = [];
  var oldRangeStart = 0,
      newRangeStart = 0,
      curRange = [],
      oldLine = 1,
      newLine = 1;
  /*istanbul ignore start*/
  var _loop = function _loop( /*istanbul ignore end*/i) {
    var current = diff[i],
        lines = current.lines || current.value.replace(/\n$/, '').split('\n');
    current.lines = lines;

    if (current.added || current.removed) {
      /*istanbul ignore start*/
      var _curRange;

      /*istanbul ignore end*/
      // If we have previous context, start with that
      if (!oldRangeStart) {
        var prev = diff[i - 1];
        oldRangeStart = oldLine;
        newRangeStart = newLine;

        if (prev) {
          curRange = options.context > 0 ? contextLines(prev.lines.slice(-options.context)) : [];
          oldRangeStart -= curRange.length;
          newRangeStart -= curRange.length;
        }
      }

      // Output our changes
      /*istanbul ignore start*/(_curRange = /*istanbul ignore end*/curRange).push. /*istanbul ignore start*/apply /*istanbul ignore end*/( /*istanbul ignore start*/_curRange /*istanbul ignore end*/, /*istanbul ignore start*/_toConsumableArray( /*istanbul ignore end*/lines.map(function (entry) {
        return (current.added ? '+' : '-') + entry;
      })));

      // Track the updated file position
      if (current.added) {
        newLine += lines.length;
      } else {
        oldLine += lines.length;
      }
    } else {
      // Identical context lines. Track line changes
      if (oldRangeStart) {
        // Close out any changes that have been output (or join overlapping)
        if (lines.length <= options.context * 2 && i < diff.length - 2) {
          /*istanbul ignore start*/
          var _curRange2;

          /*istanbul ignore end*/
          // Overlapping
          /*istanbul ignore start*/(_curRange2 = /*istanbul ignore end*/curRange).push. /*istanbul ignore start*/apply /*istanbul ignore end*/( /*istanbul ignore start*/_curRange2 /*istanbul ignore end*/, /*istanbul ignore start*/_toConsumableArray( /*istanbul ignore end*/contextLines(lines)));
        } else {
          /*istanbul ignore start*/
          var _curRange3;

          /*istanbul ignore end*/
          // end the range and output
          var contextSize = Math.min(lines.length, options.context);
          /*istanbul ignore start*/(_curRange3 = /*istanbul ignore end*/curRange).push. /*istanbul ignore start*/apply /*istanbul ignore end*/( /*istanbul ignore start*/_curRange3 /*istanbul ignore end*/, /*istanbul ignore start*/_toConsumableArray( /*istanbul ignore end*/contextLines(lines.slice(0, contextSize))));

          var hunk = {
            oldStart: oldRangeStart,
            oldLines: oldLine - oldRangeStart + contextSize,
            newStart: newRangeStart,
            newLines: newLine - newRangeStart + contextSize,
            lines: curRange
          };
          if (i >= diff.length - 2 && lines.length <= options.context) {
            // EOF is inside this hunk
            var oldEOFNewline = /\n$/.test(oldStr);
            var newEOFNewline = /\n$/.test(newStr);
            if (lines.length == 0 && !oldEOFNewline) {
              // special case: old has no eol and no trailing context; no-nl can end up before adds
              curRange.splice(hunk.oldLines, 0, '\\ No newline at end of file');
            } else if (!oldEOFNewline || !newEOFNewline) {
              curRange.push('\\ No newline at end of file');
            }
          }
          hunks.push(hunk);

          oldRangeStart = 0;
          newRangeStart = 0;
          curRange = [];
        }
      }
      oldLine += lines.length;
      newLine += lines.length;
    }
  };

  for (var i = 0; i < diff.length; i++) {
    /*istanbul ignore start*/
    _loop( /*istanbul ignore end*/i);
  }

  return {
    oldFileName: oldFileName, newFileName: newFileName,
    oldHeader: oldHeader, newHeader: newHeader,
    hunks: hunks
  };
}

function createTwoFilesPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
  var diff = structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options);

  var ret = [];
  if (oldFileName == newFileName) {
    ret.push('Index: ' + oldFileName);
  }
  ret.push('===================================================================');
  ret.push('--- ' + diff.oldFileName + (typeof diff.oldHeader === 'undefined' ? '' : '\t' + diff.oldHeader));
  ret.push('+++ ' + diff.newFileName + (typeof diff.newHeader === 'undefined' ? '' : '\t' + diff.newHeader));

  for (var i = 0; i < diff.hunks.length; i++) {
    var hunk = diff.hunks[i];
    ret.push('@@ -' + hunk.oldStart + ',' + hunk.oldLines + ' +' + hunk.newStart + ',' + hunk.newLines + ' @@');
    ret.push.apply(ret, hunk.lines);
  }

  return ret.join('\n') + '\n';
}

function createPatch(fileName, oldStr, newStr, oldHeader, newHeader, options) {
  return createTwoFilesPatch(fileName, fileName, oldStr, newStr, oldHeader, newHeader, options);
}


},{"../diff/line":8}],14:[function(require,module,exports){
/*istanbul ignore start*/'use strict';

exports.__esModule = true;
exports. /*istanbul ignore end*/parsePatch = parsePatch;
function parsePatch(uniDiff) {
  /*istanbul ignore start*/var /*istanbul ignore end*/options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  var diffstr = uniDiff.split('\n'),
      list = [],
      i = 0;

  function parseIndex() {
    var index = {};
    list.push(index);

    // Parse diff metadata
    while (i < diffstr.length) {
      var line = diffstr[i];

      // File header found, end parsing diff metadata
      if (/^(\-\-\-|\+\+\+|@@)\s/.test(line)) {
        break;
      }

      // Diff index
      var header = /^(?:Index:|diff(?: -r \w+)+)\s+(.+?)\s*$/.exec(line);
      if (header) {
        index.index = header[1];
      }

      i++;
    }

    // Parse file headers if they are defined. Unified diff requires them, but
    // there's no technical issues to have an isolated hunk without file header
    parseFileHeader(index);
    parseFileHeader(index);

    // Parse hunks
    index.hunks = [];

    while (i < diffstr.length) {
      var _line = diffstr[i];

      if (/^(Index:|diff|\-\-\-|\+\+\+)\s/.test(_line)) {
        break;
      } else if (/^@@/.test(_line)) {
        index.hunks.push(parseHunk());
      } else if (_line && options.strict) {
        // Ignore unexpected content unless in strict mode
        throw new Error('Unknown line ' + (i + 1) + ' ' + JSON.stringify(_line));
      } else {
        i++;
      }
    }
  }

  // Parses the --- and +++ headers, if none are found, no lines
  // are consumed.
  function parseFileHeader(index) {
    var headerPattern = /^(---|\+\+\+)\s+([\S ]*)(?:\t(.*?)\s*)?$/;
    var fileHeader = headerPattern.exec(diffstr[i]);
    if (fileHeader) {
      var keyPrefix = fileHeader[1] === '---' ? 'old' : 'new';
      index[keyPrefix + 'FileName'] = fileHeader[2];
      index[keyPrefix + 'Header'] = fileHeader[3];

      i++;
    }
  }

  // Parses a hunk
  // This assumes that we are at the start of a hunk.
  function parseHunk() {
    var chunkHeaderIndex = i,
        chunkHeaderLine = diffstr[i++],
        chunkHeader = chunkHeaderLine.split(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);

    var hunk = {
      oldStart: +chunkHeader[1],
      oldLines: +chunkHeader[2] || 1,
      newStart: +chunkHeader[3],
      newLines: +chunkHeader[4] || 1,
      lines: []
    };

    var addCount = 0,
        removeCount = 0;
    for (; i < diffstr.length; i++) {
      var operation = diffstr[i][0];

      if (operation === '+' || operation === '-' || operation === ' ' || operation === '\\') {
        hunk.lines.push(diffstr[i]);

        if (operation === '+') {
          addCount++;
        } else if (operation === '-') {
          removeCount++;
        } else if (operation === ' ') {
          addCount++;
          removeCount++;
        }
      } else {
        break;
      }
    }

    // Handle the empty block count case
    if (!addCount && hunk.newLines === 1) {
      hunk.newLines = 0;
    }
    if (!removeCount && hunk.oldLines === 1) {
      hunk.oldLines = 0;
    }

    // Perform optional sanity checking
    if (options.strict) {
      if (addCount !== hunk.newLines) {
        throw new Error('Added line count did not match for hunk at line ' + (chunkHeaderIndex + 1));
      }
      if (removeCount !== hunk.oldLines) {
        throw new Error('Removed line count did not match for hunk at line ' + (chunkHeaderIndex + 1));
      }
    }

    return hunk;
  }

  while (i < diffstr.length) {
    parseIndex();
  }

  return list;
}


},{}],15:[function(require,module,exports){
/*istanbul ignore start*/"use strict";

exports.__esModule = true;

exports.default = /*istanbul ignore end*/function (start, minLine, maxLine) {
  var wantForward = true,
      backwardExhausted = false,
      forwardExhausted = false,
      localOffset = 1;

  return function iterator() {
    if (wantForward && !forwardExhausted) {
      if (backwardExhausted) {
        localOffset++;
      } else {
        wantForward = false;
      }

      // Check if trying to fit beyond text length, and if not, check it fits
      // after offset location (or desired location on first iteration)
      if (start + localOffset <= maxLine) {
        return localOffset;
      }

      forwardExhausted = true;
    }

    if (!backwardExhausted) {
      if (!forwardExhausted) {
        wantForward = true;
      }

      // Check if trying to fit before text beginning, and if not, check it fits
      // before offset location
      if (minLine <= start - localOffset) {
        return -localOffset++;
      }

      backwardExhausted = true;
      return iterator();
    }

    // We tried to fit hunk before text beginning and beyond text lenght, then
    // hunk can't fit on the text. Return undefined
  };
};


},{}],16:[function(require,module,exports){
/*istanbul ignore start*/'use strict';

exports.__esModule = true;
exports. /*istanbul ignore end*/generateOptions = generateOptions;
function generateOptions(options, defaults) {
  if (typeof options === 'function') {
    defaults.callback = options;
  } else if (options) {
    for (var name in options) {
      /* istanbul ignore else */
      if (options.hasOwnProperty(name)) {
        defaults[name] = options[name];
      }
    }
  }
  return defaults;
}


},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9hZnJhbWUtc2VydmVyLXV0aWxzLmpzIiwibm9kZV9tb2R1bGVzL2RpZmYvc3JjL2NvbnZlcnQvZG1wLmpzIiwibm9kZV9tb2R1bGVzL2RpZmYvc3JjL2NvbnZlcnQveG1sLmpzIiwibm9kZV9tb2R1bGVzL2RpZmYvc3JjL2RpZmYvYmFzZS5qcyIsIm5vZGVfbW9kdWxlcy9kaWZmL3NyYy9kaWZmL2NoYXJhY3Rlci5qcyIsIm5vZGVfbW9kdWxlcy9kaWZmL3NyYy9kaWZmL2Nzcy5qcyIsIm5vZGVfbW9kdWxlcy9kaWZmL3NyYy9kaWZmL2pzb24uanMiLCJub2RlX21vZHVsZXMvZGlmZi9zcmMvZGlmZi9saW5lLmpzIiwibm9kZV9tb2R1bGVzL2RpZmYvc3JjL2RpZmYvc2VudGVuY2UuanMiLCJub2RlX21vZHVsZXMvZGlmZi9zcmMvZGlmZi93b3JkLmpzIiwibm9kZV9tb2R1bGVzL2RpZmYvc3JjL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2RpZmYvc3JjL3BhdGNoL2FwcGx5LmpzIiwibm9kZV9tb2R1bGVzL2RpZmYvc3JjL3BhdGNoL2NyZWF0ZS5qcyIsIm5vZGVfbW9kdWxlcy9kaWZmL3NyYy9wYXRjaC9wYXJzZS5qcyIsIm5vZGVfbW9kdWxlcy9kaWZmL3NyYy91dGlsL2Rpc3RhbmNlLWl0ZXJhdG9yLmpzIiwibm9kZV9tb2R1bGVzL2RpZmYvc3JjL3V0aWwvcGFyYW1zLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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QVA7QUFDRDs7QUFFRCx5QkFBbUIsSUFBbkI7QUFDRDs7QUFFRCxRQUFJLENBQUMsaUJBQUwsRUFBd0I7QUFDdEIsVUFBSSxDQUFDLGdCQUFMLEVBQXVCO0FBQ3JCLHNCQUFjLElBQWQ7QUFDRDs7OztBQUlELFVBQUksV0FBVyxRQUFRLFdBQXZCLEVBQW9DO0FBQ2xDLGVBQU8sQ0FBQyxhQUFSO0FBQ0Q7O0FBRUQsMEJBQW9CLElBQXBCO0FBQ0EsYUFBTyxVQUFQO0FBQ0Q7Ozs7QUFJRixHQWxDRDtBQW1DRCxDOzs7Ozs7O2dDQzVDZSxlLEdBQUEsZTtBQUFULFNBQVMsZUFBVCxDQUF5QixPQUF6QixFQUFrQyxRQUFsQyxFQUE0QztBQUNqRCxNQUFJLE9BQU8sT0FBUCxLQUFtQixVQUF2QixFQUFtQztBQUNqQyxhQUFTLFFBQVQsR0FBb0IsT0FBcEI7QUFDRCxHQUZELE1BRU8sSUFBSSxPQUFKLEVBQWE7QUFDbEIsU0FBSyxJQUFJLElBQVQsSUFBaUIsT0FBakIsRUFBMEI7O0FBRXhCLFVBQUksUUFBUSxjQUFSLENBQXVCLElBQXZCLENBQUosRUFBa0M7QUFDaEMsaUJBQVMsSUFBVCxJQUFpQixRQUFRLElBQVIsQ0FBakI7QUFDRDtBQUNGO0FBQ0Y7QUFDRCxTQUFPLFFBQVA7QUFDRCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKiBSZWxvYWQgdGhlIGFmcmFtZSBkeW5hbWljYWxseSwgYXMgbmVlZGVkLiBQdXQgdGhlIHNjZW5lIGJhY2sgdG8gdGhlIHNlcnZlciwgYXMgbmVlZGVkLlxuICovXG5cbnZhciBkaWZmID0gcmVxdWlyZShcImRpZmZcIik7XG5cbmZ1bmN0aW9uIFNlcnZlclV0aWxzICgpIHtcblxuICAvLyAoRnJvbSBhZnJhbWUtZWRpdG9yKVxuICAvLyBEZXRlY3QgaWYgdGhlIHNjZW5lIGlzIGFscmVhZHkgbG9hZGVkXG4gIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnY29tcGxldGUnIHx8IGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkZWQnKSB7XG4gICAgdGhpcy5vbkRvbUxvYWRlZCgpO1xuICB9IGVsc2Uge1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCB0aGlzLm9uRG9tTG9hZGVkLmJpbmQodGhpcykpO1xuICB9XG59XG5cblNlcnZlclV0aWxzLnByb3RvdHlwZSA9IHtcblxuICBvbkRvbUxvYWRlZDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuc2NlbmVFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2Etc2NlbmUnKTtcbiAgICBpZiAodGhpcy5zY2VuZUVsID09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRoaXMuc2NlbmVFbC5oYXNMb2FkZWQpIHtcbiAgICAgIHRoaXMub25TY2VuZUxvYWRlZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNjZW5lRWwuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkJywgdGhpcy5vblNjZW5lTG9hZGVkLmJpbmQodGhpcykpO1xuICAgIH1cbiAgfSxcblxuICBvblNjZW5lTG9hZGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgLy8gRXZlcnl0aGluZyBpcyByZWFkeSB0byBnby5cbiAgICAvLyBGcm9tIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvOTc5OTc1L2hvdy10by1nZXQtdGhlLXZhbHVlLWZyb20tdGhlLWdldC1wYXJhbWV0ZXJzXG4gICAgdmFyIHBhcmFtcyA9IHdpbmRvdy5sb2NhdGlvbi5zZWFyY2hcbiAgICAgIC5zdWJzdHJpbmcoMSlcbiAgICAgIC5zcGxpdChcIiZcIilcbiAgICAgIC5tYXAodiA9PiB2LnNwbGl0KFwiPVwiKSlcbiAgICAgIC5yZWR1Y2UoKG1hcCwgW2tleSwgdmFsdWVdKSA9PiBtYXAuc2V0KGtleSwgZGVjb2RlVVJJQ29tcG9uZW50KHZhbHVlKSksIG5ldyBNYXAoKSlcbiAgICBjb25zb2xlLmxvZyhcIm9uU2NlbmVMb2FkZWQgIVwiLHBhcmFtcyk7XG4gICAgLy8gRG8gd2UgbmVlZCB0byBzZW5kIHRoZSBlZGl0ZWQgU2NlbmUgYmFjayB0byB0aGUgc2VydmVyIHBlcmlvZGljYWxseT9cbiAgICBpZiAocGFyYW1zLmdldChcImVkaXRcIikgIT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmVkaXQgPSB0cnVlO1xuLy8gICAgICAkKFwiYS1zY2VuZVwiKS5hdHRyKFwiZGVidWdcIixcInRydWVcIilcbiAgICAgIGNvbnNvbGUubG9nKFwiZWRpdCBrZXkgKHMrY250bCthbHQpIGVuYWJsZWRcIik7XG4gICAgICAvLyAoZnJvbSBhZnJhbWUncyBpbnNwZWN0b3IuanMpXG4gICAgICB0aGlzLm9uS2V5ZG93biA9IHRoaXMub25LZXlkb3duLmJpbmQodGhpcyk7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMub25LZXlkb3duKTtcbiAgICAgIHRoaXMucHVzaFNjZW5lKCk7IC8vIEFuZCBhbHNvIHB1c2ggYmFjayB0aGUgaW5pdGlhbCB2ZXJzaW9uIG9mIHRoZSBzY2VuZSB0byB0aGUgc2hhZG93IEFGcmFtZSBPYmplY3QuXG4gICAgfVxuICAgIGlmIChwYXJhbXMuZ2V0KFwibG9hZFwiKSAhPSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMubG9hZCA9IHRydWU7XG4gICAgICB0aGlzLmxvYWRTY2VuZShcIkhFQURcIikgICAgICBcbiAgICB9XG4gIH0sXG4gIG9uS2V5ZG93bjogZnVuY3Rpb24gKGV2dCkge1xuICAgIC8vIChmcm9tIGFmcmFtZSdzIGluc3BlY3Rvci5qcylcbiAgICAvLyBBbHQgKyBDdHJsICsgc1xuICAgIGNvbnNvbGUubG9nKFwib25LZXlkb3duXCIsZXZ0KVxuICAgIHZhciBzaG9ydGN1dFByZXNzZWQgPSBldnQua2V5Q29kZSA9PT0gODMgJiYgZXZ0LmN0cmxLZXkgJiYgZXZ0LmFsdEtleTtcbiAgICBpZiAoIXNob3J0Y3V0UHJlc3NlZCkgeyByZXR1cm47IH1cbiAgICB0aGlzLnB1c2hTY2VuZSgpO1xuICB9LFxuICBsb2FkU2NlbmU6IGZ1bmN0aW9uKHR5KSB7XG4gICAgdmFyIHZlcnNpb24gPSAkKFwiYS1zY2VuZVwiKS5hdHRyKFwidmVyc2lvblwiKTtcbiAgICBpZiAodmVyc2lvbiA9PSB1bmRlZmluZWQgfHwgdHkgPT0gXCJSRUxPQURcIikge1xuICAgICAgLy8gZG8gdGhpcyB0aGUgc2xvdyB3YXlcbiAgICAgICQuZ2V0KCBcIi9SRVNUL3NjZW5lXCIsIHRoaXMucmVzZXRTY2VuZS5iaW5kKHRoaXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY2hlY2sgZm9yIGNoYW5nZXNcbiAgICAgICQuZ2V0SlNPTiggXCIvUkVTVC9zY2VuZS9cIiArIHZlcnNpb24sIHRoaXMudXBkYXRlU2NlbmUuYmluZCh0aGlzKSk7ICAgICAgICAgIFxuICAgIH1cbiAgfSxcbiAgdXBkYXRlU2NlbmU6IGZ1bmN0aW9uKGQpIHtcbi8vICAgIGNvbnNvbGUubG9nKFwidXBkYXRlU2NlbmVcIixkKVxuICAgIGlmIChkLmNoYW5nZSAmJiBkLmNoYW5nZSA9PSBcIkhFQURcIikge1xuICAgICAgdGhpcy5sb2FkU2NlbmUoXCJIRUFEXCIpO1xuICAgIH0gZWxzZSBpZiAoZC5jaGFuZ2UgJiYgZC5jaGFuZ2UgPT0gXCJERUxUQVNcIikge1xuICAgICAgY29uc29sZS5sb2coXCJERUxUQVNcIixkKVxuICAgICAgZC5jaGFuZ2VzLmZvckVhY2goZnVuY3Rpb24obykge1xuICAgICAgICB2YXIgcSA9IG8ucGF0aFswXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7aSA8IG8ucGF0aC5sZW5ndGg7aSs9Mikge1xuICAgICAgICAgIHEgKz0gXCIgPiBcIiArIG8ucGF0aFtpKzFdICsgXCI6bnRoLW9mLXR5cGUoXCIgKyAoby5wYXRoW2ldKzEpICsgXCIpXCJcbiAgICAgICAgfVxuICAgICAgICAvLyBUaGlzIGlzIHdoZXJlIHdlIGRvIHRoZSBtaWNyby11cGRhdGVzXG4gICAgICAgICQocSkuYXR0cihvLmF0dHIsby52YWx1ZSk7XG4gICAgICAgIGNvbnNvbGUubG9nKG8scSk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMubG9hZFNjZW5lKFwiSEVBRFwiKTsgIC8vIHRyeSByZWxvYWQgdGhlIHNjZW5lXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubG9hZFNjZW5lKFwiUkVMT0FEXCIpO1xuICAgIH1cbiAgfSxcbiAgcmVzZXRTY2VuZTogZnVuY3Rpb24oZGF0YSkge1xuICAgIGlmICgkKFwiYS1zY2VuZVwiKS5sZW5ndGggPT0gMCkge1xuICAgICAgLy8gTm93IHNob3VsZCBuZXZlciBoYXBwZW4sXG4gICAgICAvLyBidXQgaWYgaXQgZG9lcywganVzdCBsb2FkIHRoZSBET00gZGlyZWN0bHkuXG4gICAgICAkKFwiYm9keVwiKS5wcmVwZW5kKGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY2ggPSAkKFwiYS1zY2VuZVwiKS5jaGlsZHJlbigpO1xuICAgICAgZm9yKGkgPSAwO2kgPCBjaC5sZW5ndGg7aSsrKSB7XG4gICAgICAgIGlmICghY2hbaV0ubG9jYWxOYW1lXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImNhbnZhc1wiXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImRpdlwiXG4gICAgICAgICAgICAgIHx8IGNoW2ldLmxvY2FsTmFtZSA9PSBcImEtY2FtZXJhXCIgXG4gICAgICAgICAgICAgIHx8ICFjaFtpXS5hdHRyaWJ1dGVzXG4gICAgICAgICAgICAgIHx8IChjaFtpXS5sb2NhbE5hbWUgPT0gXCJhLWVudGl0eVwiIFxuICAgICAgICAgICAgICAgICAgICYmIChjaFtpXS5hdHRyaWJ1dGVzW1wiY2FtZXJhXCJdIHx8ICQoY2hbaV0pLmZpbmQoXCJhLWVudGl0eVtjYW1lcmFdXCIpLmxlbmd0aCA+IDAgfHwgJChjaFtpXSkuZmluZChcImEtY2FtZXJhXCIpLmxlbmd0aCA+IDApKVxuICAgICAgICAgICAgICB8fCBjaFtpXS5hdHRyaWJ1dGVzW1wiZGF0YS1hZnJhbWUtZGVmYXVsdC1saWdodFwiXVxuICAgICAgICAgICAgICB8fCBjaFtpXS5hdHRyaWJ1dGVzW1wiZGF0YS1hZnJhbWUtZGVmYXVsdC1jYW1lcmFcIl1cbiAgICAgICAgKSB7XG4vLyAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJsZWF2aW5nIFwiICsgaSk7XG4gICAgICAgIH0gZWxzZSB7XG4vLyAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJyZW1vdmluZyBcIiArIGkpXG4gICAgICAgICAgLy8gVGhpcyBhcHBlYXJzIHRvIGJlIGxlYXZpbmcgdGhlIFRocmVlLmpzIEdlbW9ldHJpZXMgYmVoaW5kLiBcbiAgICAgICAgICAvLyBUT0RPOiBjaGVjayBpbnRvIHRoaXNcbiAgICAgICAgICAkKGNoW2ldKS5yZW1vdmUoKVxuICAgICAgICB9XG4gICAgICB9XG4vLyAgICAgICAgICBjb25zb2xlLmxvZyhcImNoaWxkZXJuXCIsJChcImEtc2NlbmVcIikuY2hpbGRyZW4oKSlcbiAgICAgIC8vIHJlcGFjZSBhLXNjZW5lIHdpdGggeC1zY2VuZSB0byBhdm9pZCB0cmlnZ2VyaW5nIHRoZSBhLXNjZW5lIGNhbGxiYWNrXG4gICAgICAvLyAod2hpY2ggaW5zZXJ0cyB0aGUgZGVmYXVsdHMsIGFuZCB0aGVyZWZvciBtYWtlcyB0d28gY2FtZXJhLCB3aGljaCBjb25mdXNlc1xuICAgICAgLy8gIHRoZSBUSFJFRS5qcyBzdWItc3lzdGVtKS4gTm90ZSByZXBsYWNlIG9ubHkgcmVwbGFjZXMgdGhlICpmaXJzdCogXG4gICAgICAvLyBhLXNjZW5lIG9mIHRoZSBzdHJpbmcsIHNvIHdpbGwgbm90IGVmZmVjdCBhbnkgcHJvcGVydGllcy5cbiAgICAgIHZhciB4bWwgPSAkKGRhdGEucmVwbGFjZShcImEtc2NlbmVcIixcIngtc2NlbmVcIikpO1xuICAgICAgLy8gUmVtb3ZlIHRoZSBjYW1lcmEsIGlmIHRoZXJlIGlzIGFuIChleHBsaWNpdCkgb25lLlxuICAgICAgLy8gVGhlIGNhbWVyYSBpcyBuZXZlciBkeW5hbWljYWxseSB1cGRhdGVkIChidXQgY29udHJvbGxlZCBieSB0aGUgaW4tYnJvd3NlciB0b29scylcbiAgICAgIHhtbC5maW5kKFwiYS1lbnRpdHlbY2FtZXJhXVwiKS5yZW1vdmUoKVxuXG4vLyAgICAgIGNvbnNvbGUubG9nKHhtbClcbiAgICAgIHhtbC5jaGlsZHJlbigpLnByZXBlbmRUbyhcImEtc2NlbmVcIik7XG4gIFxuICAgICAgZGVidWdfeG1sID0geG1sO1xuICAgICAgJChcImEtc2NlbmVcIikuYXR0cihcInZlcnNpb25cIix4bWwuYXR0cihcInZlcnNpb25cIikpICAvLyB1cGRhdGUgdGhlIHZlcnNpb24gbnVtYmVyXG4gICAgfVxuICAgIHRoaXMubG9hZFNjZW5lKFwiSEVBRFwiKTtcbiAgfSxcbiAgcHVzaFNjZW5lOiBmdW5jdGlvbigpIHtcbiAgICBjb25zb2xlLmxvZyhcInB1c2hTY2VuZVwiKVxuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAkLmFqYXgoXG4gICAgICB7IHR5cGU6IFwiUFVUXCIsXG4gICAgICAgIHVybDogXCIvUkVTVC9zaGFkb3dcIixcbiAgICAgICAgZGF0YTogZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2JvZHknKVswXS5pbm5lckhUTUwsXG4gICAgICAgIGNvbnRlbnRUeXBlOiAgJ3RleHQvcGxhaW47IGNoYXJzZXQ9VVRGLTgnLFxuICAgICAgICBkYXRhVHlwZTogXCJqc29uXCIsICAgICAvLyByZXN1bHQgdHlwZVxuICAgICAgICBjYWNoZTogZmFsc2UsXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbigpIHtcbi8vICAgICAgICAgIGNvbnNvbGUubG9nKFwiRmFpbGVkIHRvIHNlbmQgRE9NOyByZXRyeWluZ1wiKTtcbiAgICAgICAgfSxcbiAgICAgICAgc3VjY2VzczogZnVuY3Rpb24oeG1sKSB7XG4vLyAgICAgICAgICAgICBhbGVydChcIml0IHdvcmtzXCIpO1xuLy8gICAgICAgICAgIGFsZXJ0KCQoeG1sKS5maW5kKFwicHJvamVjdFwiKVswXS5hdHRyKFwiaWRcIikpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGNvbnNvbGUubG9nKFwicHVzaFNjZW5lIC4uLlwiKTtcbiAgfSxcblxuICBpbml0RGlmZjogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICQuZ2V0KFwiL1JFU1Qvc2NlbmVcIiwgZnVuY3Rpb24obykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCIvUkVTVC9zY2VuZVwiLG8pO1xuICAgICAgICAgICAgc2VsZi5zY2VuZSA9IG87XG4gICAgICAgICAgICBzZWxmLnJlbmRlckRpZmYoKTtcbiAgICB9KTtcbiAgICAkLmdldChcIi9SRVNUL3NoYWRvd1wiLCBmdW5jdGlvbihvKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIi9SRVNUL3NoYWRvd1wiLG8pO1xuICAgICAgICAgICAgc2VsZi5zaGFkb3cgPSBvO1xuICAgICAgICAgICAgc2VsZi5yZW5kZXJEaWZmKCk7XG4gICAgfSk7XG4gIH0sXG5cbiAgcmVuZGVyTm9kZTogZnVuY3Rpb24ob3JpZyxzYXZlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICBpZiAoIW9yaWcgfHwgIW9yaWcubG9jYWxOYW1lIFxuICAgICAgICAgICAgfHwgIXNhdmVkIHx8ICFzYXZlZC5sb2NhbE5hbWUgXG4gICAgICAgICAgICB8fCAob3JpZy5sb2NhbE5hbWUgIT0gc2F2ZWQubG9jYWxOYW1lKSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJtaXNtYXRjaFwiLG9yaWcsc2F2ZWQpO1xuICAgICAgICAgICAgcmV0dXJuIFwiLVwiO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciBsaXN0T2YgPSBmdW5jdGlvbihvKSB7XG4gICAgICAgICAgICB2YXIgcmVzID0gW107XG4gICAgICAgICAgICBmb3IodmFyIGkgPSAwO2kgPCBvLmxlbmd0aDtpKyspIHtcbiAgICAgICAgICAgICAgcmVzLnB1c2goby5pdGVtKGkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXM7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdmFyIHR4dCA9IG9yaWcubG9jYWxOYW1lO1xuXG4gICAgICAgICAgdmFyIG9yaWdBdHRyID0gbGlzdE9mKG9yaWcuYXR0cmlidXRlcykubWFwKGZ1bmN0aW9uKG8pIHsgcmV0dXJuIG8ubmFtZTsgfSkuam9pbignICcpO1xuICAgICAgICAgIHZhciBzYXZlZEF0dHIgPSBsaXN0T2Yoc2F2ZWQuYXR0cmlidXRlcykubWFwKGZ1bmN0aW9uKG8pIHsgcmV0dXJuIG8ubmFtZTsgfSkuam9pbignICcpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgdmFyIGRpZmZBdHRyID0gZGlmZi5kaWZmV29yZHMob3JpZ0F0dHIsc2F2ZWRBdHRyKTsgIFxuXG4gICAgICAgICAgdHh0ICs9IFwiXFxuPHVsPlxcblwiO1xuXG4gICAgICAgICAgdmFyIG9yaWdDb3VudCA9IDA7XG4gICAgICAgICAgdmFyIHNhdmVkQ291bnQgPSAwO1xuICAgICAgICAgIGRpZmZBdHRyLmZvckVhY2goZnVuY3Rpb24ocGFydCl7XG4gICAgICAgICAgICBwYXJ0LnZhbHVlLnRyaW0oKS5zcGxpdChcIiBcIikuZm9yRWFjaChmdW5jdGlvbih3b3JkKXtcbiAgICAgICAgICAgICAgdHh0ICs9IFwiPGxpPlwiO1xuICAgICAgICAgICAgICBpZihwYXJ0LmFkZGVkKSB7XG4gICAgICAgICAgICAgICAgdHh0ICs9IFwiPGZvbnQgY29sb3I9XFxcImdyZWVuXFxcIj5cIjtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChwYXJ0LnJlbW92ZWQpIHtcbiAgICAgICAgICAgICAgICB0eHQgKz0gXCI8Zm9udCBjb2xvcj1cXFwicmVkXFxcIj5cIjsgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdHh0ICs9IHdvcmQ7XG4gICAgICAgICAgICAgIHR4dCArPSBcIiA9IFwiO1xuICAgICAgICAgICAgICBpZiAocGFydC5hZGRlZCkge1xuICAgICAgICAgICAgICAgIHR4dCArPSAnXCInICsgc2F2ZWQuYXR0cmlidXRlcy5pdGVtKHNhdmVkQ291bnQrKykudmFsdWUgKyAnXCInO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHBhcnQucmVtb3ZlZCkge1xuICAgICAgICAgICAgICAgIHR4dCArPSAnXCInICsgb3JpZy5hdHRyaWJ1dGVzLml0ZW0ob3JpZ0NvdW50KyspLnZhbHVlICsgJ1wiJztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoc2F2ZWQuYXR0cmlidXRlcy5pdGVtKHNhdmVkQ291bnQpLnZhbHVlID09IG9yaWcuYXR0cmlidXRlcy5pdGVtKG9yaWdDb3VudCkudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgIHR4dCArPSAnXCInICsgb3JpZy5hdHRyaWJ1dGVzLml0ZW0ob3JpZ0NvdW50KyspLnZhbHVlICsgJ1wiJztcbiAgICAgICAgICAgICAgICAgIHNhdmVkQ291bnQrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgdHh0ICs9ICc8Zm9udCBjb2xvcj1cImdyZWVuXCI+XCInICsgc2F2ZWQuYXR0cmlidXRlcy5pdGVtKHNhdmVkQ291bnQrKykudmFsdWUgKyAnXCI8L2ZvbnQ+JyArXG4gICAgICAgICAgICAgICAgICAgICAnIC8vIDxmb250IGNvbG9yPVwicmVkXCI+XCInICAgKyBvcmlnLmF0dHJpYnV0ZXMuaXRlbShvcmlnQ291bnQrKykudmFsdWUgICsgJ1wiPC9mb250Pic7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmKHBhcnQuYWRkZWQgfHwgcGFydC5yZW1vdmVkKSB7XG4gICAgICAgICAgICAgICAgdHh0ICs9IFwiPC9mb250PlwiOyAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB0eHQgKz0gXCI8L2xpPlwiO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICB2YXIgb3JpZ0NoaWRyZW4gICA9IGxpc3RPZihvcmlnLmNoaWxkcmVuKS5tYXAoZnVuY3Rpb24obykgeyByZXR1cm4gby5sb2NhbE5hbWU7IH0pLmpvaW4oJyAnKTtcbiAgICAgICAgICB2YXIgc2F2ZWRDaGlsZHJlbiA9IGxpc3RPZihzYXZlZC5jaGlsZHJlbikubWFwKGZ1bmN0aW9uKG8pIHsgcmV0dXJuIG8ubG9jYWxOYW1lOyB9KS5qb2luKCcgJyk7XG4gICAgICAgICAgdmFyIGRpZmZDaGlsZHJlbiAgPSBkaWZmLmRpZmZXb3JkcyhvcmlnQ2hpZHJlbixzYXZlZENoaWxkcmVuKTsgIFxuXG4gICAgICAgICAgdmFyIG9yaWdDb3VudCA9IDA7XG4gICAgICAgICAgdmFyIHNhdmVkQ291bnQgPSAwO1xuICAgICAgICAgIGRpZmZDaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKHBhcnQpe1xuICAgICAgICAgICAgcGFydC52YWx1ZS50cmltKCkuc3BsaXQoXCIgXCIpLmZvckVhY2goZnVuY3Rpb24od29yZCl7XG4gICAgICAgICAgICAgIHR4dCArPSBcIjxsaT5cIjtcbiAgICAgICAgICAgICAgaWYocGFydC5hZGRlZCkge1xuICAgICAgICAgICAgICAgIHR4dCArPSBcIjxmb250IGNvbG9yPVxcXCJncmVlblxcXCI+XCI7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAocGFydC5yZW1vdmVkKSB7XG4gICAgICAgICAgICAgICAgdHh0ICs9IFwiPGZvbnQgY29sb3I9XFxcInJlZFxcXCI+XCI7ICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmKHBhcnQuYWRkZWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3ViU2F2ZWQgPSBzYXZlZC5jaGlsZHJlbi5pdGVtKHNhdmVkQ291bnQrKyk7XG4gICAgICAgICAgICAgICAgdHh0ICs9IHNlbGYucmVuZGVyTm9kZShzdWJTYXZlZCxzdWJTYXZlZCk7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAocGFydC5yZW1vdmVkKSB7XG4gICAgICAgICAgICAgICAgdmFyIHN1Yk9yaWcgPSBvcmlnLmNoaWxkcmVuLml0ZW0ob3JpZ0NvdW50KyspO1xuICAgICAgICAgICAgICAgIHR4dCArPSBzZWxmLnJlbmRlck5vZGUoc3ViT3JpZyxzdWJPcmlnKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgc3ViT3JpZyA9IG9yaWcuY2hpbGRyZW4uaXRlbShvcmlnQ291bnQrKyk7XG4gICAgICAgICAgICAgICAgdmFyIHN1YlNhdmVkID0gc2F2ZWQuY2hpbGRyZW4uaXRlbShzYXZlZENvdW50KyspO1xuICAgICAgICAgICAgICAgIHR4dCArPSBzZWxmLnJlbmRlck5vZGUoc3ViT3JpZyxzdWJTYXZlZCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYocGFydC5hZGRlZCB8fCBwYXJ0LnJlbW92ZWQpIHtcbiAgICAgICAgICAgICAgICB0eHQgKz0gXCI8L2ZvbnQ+XCI7ICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdHh0ICs9IFwiPC9saT5cIjtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgZGVidWdnaW5nID0geyBvcmlnOiBvcmlnLCBzYXZlZDogc2F2ZWQsIGxpc3RPZjogbGlzdE9mLCBvcmlnQXR0cjpvcmlnQXR0ciwgc2F2ZWRBdHRyOiBzYXZlZEF0dHIsXG4gICAgICAgICAgICAgICAgICAgICAgIGRpZmZBdHRyOiBkaWZmQXR0ciB9O1xuXG4gICAgICAgICAgdHh0ICs9IFwiXFxuPC91bD5cXG5cIjtcbiAgICAgICAgICByZXR1cm4gdHh0O1xuICB9LFxuXG4gIHJlbmRlckRpZmY6IGZ1bmN0aW9uKCl7XG4gICAgaWYgKCF0aGlzLnNjZW5lKSB7XG4gICAgICAkKFwiI3RhcmdldFwiKS5odG1sKFwib3JpZ2luYWwgc2NlbmUgbm90IHJlYWRhYmxlXCIpO1xuICAgIH1cbiAgICB2YXIgb3JpZyA9ICQodGhpcy5zY2VuZSlbMF07XG4gICAgaWYgKCF0aGlzLnNoYWRvdykge1xuICAgICAgJChcIiN0YXJnZXRcIikuaHRtbChcInNoYWRvdyBzY2VuZSBub3QgcmVhZGFibGVcIik7XG4gICAgfVxuICAgIHZhciBzYXZlZCA9ICQodGhpcy5zaGFkb3cpWzBdO1xuICAgIGlmIChzYXZlZC5sb2NhbE5hbWUgPT0gXCJkaXZcIikge1xuICAgICAgJChcIiN0YXJnZXRcIikuaHRtbChcInNoYWRvdyBzY2VuZSBub3Qgc2F2ZWQgKHlldClcIik7ICAgICAgXG4gICAgfVxuXG4gICAgdmFyIGh0bWwgPSB0aGlzLnJlbmRlck5vZGUob3JpZyxzYXZlZCk7XG4gICAgJChcIiN0YXJnZXRcIikuaHRtbChodG1sKTtcbiAgfVxuICBcbiAgXG4vKlxuICAgICAgICB2YXIgc2NlbmUgID0gbnVsbDtcbiAgICAgICAgdmFyIHNoYWRvdyA9IG51bGw7XG5cbiAgICAgICAgdmFyIHJlbmRlck5vZGUgPSBmdW5jdGlvbih4bWwpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXhtbC5sb2NhbE5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBcIj8/P1wiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgdHh0ID0geG1sLmxvY2FsTmFtZTtcbiAgICAgICAgICAgICAgICB0eHQgKz0gXCJcXG48dWw+XFxuXCI7XG4gICAgICAgICAgICAgICAgZm9yKHZhciBpID0gMDtpIDwgeG1sLmF0dHJpYnV0ZXMubGVuZ3RoO2krKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGl0ZW0gPSB4bWwuYXR0cmlidXRlcy5pdGVtKGkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHh0ICs9IFwiPGxpPlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHh0ICs9IGl0ZW0ubmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR4dCArPSBcIiA9IFwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHh0ICs9IFwiXFxcIlwiICsgaXRlbS52YWx1ZSArIFwiXFxcIlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHh0ICs9IFwiPC9saT5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yKHZhciBpID0gMDtpIDwgeG1sLmNoaWxkcmVuLmxlbmd0aDtpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjaGlsZCA9IHhtbC5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR4dCArPSBcIjxsaT5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR4dCArPSByZW5kZXJOb2RlKGNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR4dCArPSBcIjwvbGk+XCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHR4dCArPSBcIlxcbjwvdWw+XFxuXCI7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHR4dDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdmFyIHJlbmRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICB2YXIgeG1sID0gJChzY2VuZSlbMF07XG4gICAgICAgICAgIHZhciBodG1sID0gcmVuZGVyTm9kZSh4bWwpO1xuICAgICAgICAgICAkKFwiI3RhcmdldFwiKS5odG1sKGh0bWwpO1xuICAgICAgICB9O1xuXG4qLyAgXG4gIFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBuZXcgU2VydmVyVXRpbHMoKTtcblxuIiwiLy8gU2VlOiBodHRwOi8vY29kZS5nb29nbGUuY29tL3AvZ29vZ2xlLWRpZmYtbWF0Y2gtcGF0Y2gvd2lraS9BUElcbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0Q2hhbmdlc1RvRE1QKGNoYW5nZXMpIHtcbiAgbGV0IHJldCA9IFtdLFxuICAgICAgY2hhbmdlLFxuICAgICAgb3BlcmF0aW9uO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGNoYW5nZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjaGFuZ2UgPSBjaGFuZ2VzW2ldO1xuICAgIGlmIChjaGFuZ2UuYWRkZWQpIHtcbiAgICAgIG9wZXJhdGlvbiA9IDE7XG4gICAgfSBlbHNlIGlmIChjaGFuZ2UucmVtb3ZlZCkge1xuICAgICAgb3BlcmF0aW9uID0gLTE7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wZXJhdGlvbiA9IDA7XG4gICAgfVxuXG4gICAgcmV0LnB1c2goW29wZXJhdGlvbiwgY2hhbmdlLnZhbHVlXSk7XG4gIH1cbiAgcmV0dXJuIHJldDtcbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0Q2hhbmdlc1RvWE1MKGNoYW5nZXMpIHtcbiAgbGV0IHJldCA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGNoYW5nZXMubGVuZ3RoOyBpKyspIHtcbiAgICBsZXQgY2hhbmdlID0gY2hhbmdlc1tpXTtcbiAgICBpZiAoY2hhbmdlLmFkZGVkKSB7XG4gICAgICByZXQucHVzaCgnPGlucz4nKTtcbiAgICB9IGVsc2UgaWYgKGNoYW5nZS5yZW1vdmVkKSB7XG4gICAgICByZXQucHVzaCgnPGRlbD4nKTtcbiAgICB9XG5cbiAgICByZXQucHVzaChlc2NhcGVIVE1MKGNoYW5nZS52YWx1ZSkpO1xuXG4gICAgaWYgKGNoYW5nZS5hZGRlZCkge1xuICAgICAgcmV0LnB1c2goJzwvaW5zPicpO1xuICAgIH0gZWxzZSBpZiAoY2hhbmdlLnJlbW92ZWQpIHtcbiAgICAgIHJldC5wdXNoKCc8L2RlbD4nKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJldC5qb2luKCcnKTtcbn1cblxuZnVuY3Rpb24gZXNjYXBlSFRNTChzKSB7XG4gIGxldCBuID0gcztcbiAgbiA9IG4ucmVwbGFjZSgvJi9nLCAnJmFtcDsnKTtcbiAgbiA9IG4ucmVwbGFjZSgvPC9nLCAnJmx0OycpO1xuICBuID0gbi5yZXBsYWNlKC8+L2csICcmZ3Q7Jyk7XG4gIG4gPSBuLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKTtcblxuICByZXR1cm4gbjtcbn1cbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIERpZmYoKSB7fVxuXG5EaWZmLnByb3RvdHlwZSA9IHtcbiAgZGlmZihvbGRTdHJpbmcsIG5ld1N0cmluZywgb3B0aW9ucyA9IHt9KSB7XG4gICAgbGV0IGNhbGxiYWNrID0gb3B0aW9ucy5jYWxsYmFjaztcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcblxuICAgIGxldCBzZWxmID0gdGhpcztcblxuICAgIGZ1bmN0aW9uIGRvbmUodmFsdWUpIHtcbiAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBjYWxsYmFjayh1bmRlZmluZWQsIHZhbHVlKTsgfSwgMCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFsbG93IHN1YmNsYXNzZXMgdG8gbWFzc2FnZSB0aGUgaW5wdXQgcHJpb3IgdG8gcnVubmluZ1xuICAgIG9sZFN0cmluZyA9IHRoaXMuY2FzdElucHV0KG9sZFN0cmluZyk7XG4gICAgbmV3U3RyaW5nID0gdGhpcy5jYXN0SW5wdXQobmV3U3RyaW5nKTtcblxuICAgIG9sZFN0cmluZyA9IHRoaXMucmVtb3ZlRW1wdHkodGhpcy50b2tlbml6ZShvbGRTdHJpbmcpKTtcbiAgICBuZXdTdHJpbmcgPSB0aGlzLnJlbW92ZUVtcHR5KHRoaXMudG9rZW5pemUobmV3U3RyaW5nKSk7XG5cbiAgICBsZXQgbmV3TGVuID0gbmV3U3RyaW5nLmxlbmd0aCwgb2xkTGVuID0gb2xkU3RyaW5nLmxlbmd0aDtcbiAgICBsZXQgZWRpdExlbmd0aCA9IDE7XG4gICAgbGV0IG1heEVkaXRMZW5ndGggPSBuZXdMZW4gKyBvbGRMZW47XG4gICAgbGV0IGJlc3RQYXRoID0gW3sgbmV3UG9zOiAtMSwgY29tcG9uZW50czogW10gfV07XG5cbiAgICAvLyBTZWVkIGVkaXRMZW5ndGggPSAwLCBpLmUuIHRoZSBjb250ZW50IHN0YXJ0cyB3aXRoIHRoZSBzYW1lIHZhbHVlc1xuICAgIGxldCBvbGRQb3MgPSB0aGlzLmV4dHJhY3RDb21tb24oYmVzdFBhdGhbMF0sIG5ld1N0cmluZywgb2xkU3RyaW5nLCAwKTtcbiAgICBpZiAoYmVzdFBhdGhbMF0ubmV3UG9zICsgMSA+PSBuZXdMZW4gJiYgb2xkUG9zICsgMSA+PSBvbGRMZW4pIHtcbiAgICAgIC8vIElkZW50aXR5IHBlciB0aGUgZXF1YWxpdHkgYW5kIHRva2VuaXplclxuICAgICAgcmV0dXJuIGRvbmUoW3t2YWx1ZTogbmV3U3RyaW5nLmpvaW4oJycpLCBjb3VudDogbmV3U3RyaW5nLmxlbmd0aH1dKTtcbiAgICB9XG5cbiAgICAvLyBNYWluIHdvcmtlciBtZXRob2QuIGNoZWNrcyBhbGwgcGVybXV0YXRpb25zIG9mIGEgZ2l2ZW4gZWRpdCBsZW5ndGggZm9yIGFjY2VwdGFuY2UuXG4gICAgZnVuY3Rpb24gZXhlY0VkaXRMZW5ndGgoKSB7XG4gICAgICBmb3IgKGxldCBkaWFnb25hbFBhdGggPSAtMSAqIGVkaXRMZW5ndGg7IGRpYWdvbmFsUGF0aCA8PSBlZGl0TGVuZ3RoOyBkaWFnb25hbFBhdGggKz0gMikge1xuICAgICAgICBsZXQgYmFzZVBhdGg7XG4gICAgICAgIGxldCBhZGRQYXRoID0gYmVzdFBhdGhbZGlhZ29uYWxQYXRoIC0gMV0sXG4gICAgICAgICAgICByZW1vdmVQYXRoID0gYmVzdFBhdGhbZGlhZ29uYWxQYXRoICsgMV0sXG4gICAgICAgICAgICBvbGRQb3MgPSAocmVtb3ZlUGF0aCA/IHJlbW92ZVBhdGgubmV3UG9zIDogMCkgLSBkaWFnb25hbFBhdGg7XG4gICAgICAgIGlmIChhZGRQYXRoKSB7XG4gICAgICAgICAgLy8gTm8gb25lIGVsc2UgaXMgZ29pbmcgdG8gYXR0ZW1wdCB0byB1c2UgdGhpcyB2YWx1ZSwgY2xlYXIgaXRcbiAgICAgICAgICBiZXN0UGF0aFtkaWFnb25hbFBhdGggLSAxXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjYW5BZGQgPSBhZGRQYXRoICYmIGFkZFBhdGgubmV3UG9zICsgMSA8IG5ld0xlbixcbiAgICAgICAgICAgIGNhblJlbW92ZSA9IHJlbW92ZVBhdGggJiYgMCA8PSBvbGRQb3MgJiYgb2xkUG9zIDwgb2xkTGVuO1xuICAgICAgICBpZiAoIWNhbkFkZCAmJiAhY2FuUmVtb3ZlKSB7XG4gICAgICAgICAgLy8gSWYgdGhpcyBwYXRoIGlzIGEgdGVybWluYWwgdGhlbiBwcnVuZVxuICAgICAgICAgIGJlc3RQYXRoW2RpYWdvbmFsUGF0aF0gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZWxlY3QgdGhlIGRpYWdvbmFsIHRoYXQgd2Ugd2FudCB0byBicmFuY2ggZnJvbS4gV2Ugc2VsZWN0IHRoZSBwcmlvclxuICAgICAgICAvLyBwYXRoIHdob3NlIHBvc2l0aW9uIGluIHRoZSBuZXcgc3RyaW5nIGlzIHRoZSBmYXJ0aGVzdCBmcm9tIHRoZSBvcmlnaW5cbiAgICAgICAgLy8gYW5kIGRvZXMgbm90IHBhc3MgdGhlIGJvdW5kcyBvZiB0aGUgZGlmZiBncmFwaFxuICAgICAgICBpZiAoIWNhbkFkZCB8fCAoY2FuUmVtb3ZlICYmIGFkZFBhdGgubmV3UG9zIDwgcmVtb3ZlUGF0aC5uZXdQb3MpKSB7XG4gICAgICAgICAgYmFzZVBhdGggPSBjbG9uZVBhdGgocmVtb3ZlUGF0aCk7XG4gICAgICAgICAgc2VsZi5wdXNoQ29tcG9uZW50KGJhc2VQYXRoLmNvbXBvbmVudHMsIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYmFzZVBhdGggPSBhZGRQYXRoOyAgIC8vIE5vIG5lZWQgdG8gY2xvbmUsIHdlJ3ZlIHB1bGxlZCBpdCBmcm9tIHRoZSBsaXN0XG4gICAgICAgICAgYmFzZVBhdGgubmV3UG9zKys7XG4gICAgICAgICAgc2VsZi5wdXNoQ29tcG9uZW50KGJhc2VQYXRoLmNvbXBvbmVudHMsIHRydWUsIHVuZGVmaW5lZCk7XG4gICAgICAgIH1cblxuICAgICAgICBvbGRQb3MgPSBzZWxmLmV4dHJhY3RDb21tb24oYmFzZVBhdGgsIG5ld1N0cmluZywgb2xkU3RyaW5nLCBkaWFnb25hbFBhdGgpO1xuXG4gICAgICAgIC8vIElmIHdlIGhhdmUgaGl0IHRoZSBlbmQgb2YgYm90aCBzdHJpbmdzLCB0aGVuIHdlIGFyZSBkb25lXG4gICAgICAgIGlmIChiYXNlUGF0aC5uZXdQb3MgKyAxID49IG5ld0xlbiAmJiBvbGRQb3MgKyAxID49IG9sZExlbikge1xuICAgICAgICAgIHJldHVybiBkb25lKGJ1aWxkVmFsdWVzKHNlbGYsIGJhc2VQYXRoLmNvbXBvbmVudHMsIG5ld1N0cmluZywgb2xkU3RyaW5nLCBzZWxmLnVzZUxvbmdlc3RUb2tlbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSB0cmFjayB0aGlzIHBhdGggYXMgYSBwb3RlbnRpYWwgY2FuZGlkYXRlIGFuZCBjb250aW51ZS5cbiAgICAgICAgICBiZXN0UGF0aFtkaWFnb25hbFBhdGhdID0gYmFzZVBhdGg7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZWRpdExlbmd0aCsrO1xuICAgIH1cblxuICAgIC8vIFBlcmZvcm1zIHRoZSBsZW5ndGggb2YgZWRpdCBpdGVyYXRpb24uIElzIGEgYml0IGZ1Z2x5IGFzIHRoaXMgaGFzIHRvIHN1cHBvcnQgdGhlXG4gICAgLy8gc3luYyBhbmQgYXN5bmMgbW9kZSB3aGljaCBpcyBuZXZlciBmdW4uIExvb3BzIG92ZXIgZXhlY0VkaXRMZW5ndGggdW50aWwgYSB2YWx1ZVxuICAgIC8vIGlzIHByb2R1Y2VkLlxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgKGZ1bmN0aW9uIGV4ZWMoKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgLy8gVGhpcyBzaG91bGQgbm90IGhhcHBlbiwgYnV0IHdlIHdhbnQgdG8gYmUgc2FmZS5cbiAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgICAgIGlmIChlZGl0TGVuZ3RoID4gbWF4RWRpdExlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCFleGVjRWRpdExlbmd0aCgpKSB7XG4gICAgICAgICAgICBleGVjKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCAwKTtcbiAgICAgIH0oKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdoaWxlIChlZGl0TGVuZ3RoIDw9IG1heEVkaXRMZW5ndGgpIHtcbiAgICAgICAgbGV0IHJldCA9IGV4ZWNFZGl0TGVuZ3RoKCk7XG4gICAgICAgIGlmIChyZXQpIHtcbiAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHB1c2hDb21wb25lbnQoY29tcG9uZW50cywgYWRkZWQsIHJlbW92ZWQpIHtcbiAgICBsZXQgbGFzdCA9IGNvbXBvbmVudHNbY29tcG9uZW50cy5sZW5ndGggLSAxXTtcbiAgICBpZiAobGFzdCAmJiBsYXN0LmFkZGVkID09PSBhZGRlZCAmJiBsYXN0LnJlbW92ZWQgPT09IHJlbW92ZWQpIHtcbiAgICAgIC8vIFdlIG5lZWQgdG8gY2xvbmUgaGVyZSBhcyB0aGUgY29tcG9uZW50IGNsb25lIG9wZXJhdGlvbiBpcyBqdXN0XG4gICAgICAvLyBhcyBzaGFsbG93IGFycmF5IGNsb25lXG4gICAgICBjb21wb25lbnRzW2NvbXBvbmVudHMubGVuZ3RoIC0gMV0gPSB7Y291bnQ6IGxhc3QuY291bnQgKyAxLCBhZGRlZDogYWRkZWQsIHJlbW92ZWQ6IHJlbW92ZWQgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29tcG9uZW50cy5wdXNoKHtjb3VudDogMSwgYWRkZWQ6IGFkZGVkLCByZW1vdmVkOiByZW1vdmVkIH0pO1xuICAgIH1cbiAgfSxcbiAgZXh0cmFjdENvbW1vbihiYXNlUGF0aCwgbmV3U3RyaW5nLCBvbGRTdHJpbmcsIGRpYWdvbmFsUGF0aCkge1xuICAgIGxldCBuZXdMZW4gPSBuZXdTdHJpbmcubGVuZ3RoLFxuICAgICAgICBvbGRMZW4gPSBvbGRTdHJpbmcubGVuZ3RoLFxuICAgICAgICBuZXdQb3MgPSBiYXNlUGF0aC5uZXdQb3MsXG4gICAgICAgIG9sZFBvcyA9IG5ld1BvcyAtIGRpYWdvbmFsUGF0aCxcblxuICAgICAgICBjb21tb25Db3VudCA9IDA7XG4gICAgd2hpbGUgKG5ld1BvcyArIDEgPCBuZXdMZW4gJiYgb2xkUG9zICsgMSA8IG9sZExlbiAmJiB0aGlzLmVxdWFscyhuZXdTdHJpbmdbbmV3UG9zICsgMV0sIG9sZFN0cmluZ1tvbGRQb3MgKyAxXSkpIHtcbiAgICAgIG5ld1BvcysrO1xuICAgICAgb2xkUG9zKys7XG4gICAgICBjb21tb25Db3VudCsrO1xuICAgIH1cblxuICAgIGlmIChjb21tb25Db3VudCkge1xuICAgICAgYmFzZVBhdGguY29tcG9uZW50cy5wdXNoKHtjb3VudDogY29tbW9uQ291bnR9KTtcbiAgICB9XG5cbiAgICBiYXNlUGF0aC5uZXdQb3MgPSBuZXdQb3M7XG4gICAgcmV0dXJuIG9sZFBvcztcbiAgfSxcblxuICBlcXVhbHMobGVmdCwgcmlnaHQpIHtcbiAgICByZXR1cm4gbGVmdCA9PT0gcmlnaHQ7XG4gIH0sXG4gIHJlbW92ZUVtcHR5KGFycmF5KSB7XG4gICAgbGV0IHJldCA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhcnJheVtpXSkge1xuICAgICAgICByZXQucHVzaChhcnJheVtpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH0sXG4gIGNhc3RJbnB1dCh2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfSxcbiAgdG9rZW5pemUodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUuc3BsaXQoJycpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBidWlsZFZhbHVlcyhkaWZmLCBjb21wb25lbnRzLCBuZXdTdHJpbmcsIG9sZFN0cmluZywgdXNlTG9uZ2VzdFRva2VuKSB7XG4gIGxldCBjb21wb25lbnRQb3MgPSAwLFxuICAgICAgY29tcG9uZW50TGVuID0gY29tcG9uZW50cy5sZW5ndGgsXG4gICAgICBuZXdQb3MgPSAwLFxuICAgICAgb2xkUG9zID0gMDtcblxuICBmb3IgKDsgY29tcG9uZW50UG9zIDwgY29tcG9uZW50TGVuOyBjb21wb25lbnRQb3MrKykge1xuICAgIGxldCBjb21wb25lbnQgPSBjb21wb25lbnRzW2NvbXBvbmVudFBvc107XG4gICAgaWYgKCFjb21wb25lbnQucmVtb3ZlZCkge1xuICAgICAgaWYgKCFjb21wb25lbnQuYWRkZWQgJiYgdXNlTG9uZ2VzdFRva2VuKSB7XG4gICAgICAgIGxldCB2YWx1ZSA9IG5ld1N0cmluZy5zbGljZShuZXdQb3MsIG5ld1BvcyArIGNvbXBvbmVudC5jb3VudCk7XG4gICAgICAgIHZhbHVlID0gdmFsdWUubWFwKGZ1bmN0aW9uKHZhbHVlLCBpKSB7XG4gICAgICAgICAgbGV0IG9sZFZhbHVlID0gb2xkU3RyaW5nW29sZFBvcyArIGldO1xuICAgICAgICAgIHJldHVybiBvbGRWYWx1ZS5sZW5ndGggPiB2YWx1ZS5sZW5ndGggPyBvbGRWYWx1ZSA6IHZhbHVlO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb21wb25lbnQudmFsdWUgPSB2YWx1ZS5qb2luKCcnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbXBvbmVudC52YWx1ZSA9IG5ld1N0cmluZy5zbGljZShuZXdQb3MsIG5ld1BvcyArIGNvbXBvbmVudC5jb3VudCkuam9pbignJyk7XG4gICAgICB9XG4gICAgICBuZXdQb3MgKz0gY29tcG9uZW50LmNvdW50O1xuXG4gICAgICAvLyBDb21tb24gY2FzZVxuICAgICAgaWYgKCFjb21wb25lbnQuYWRkZWQpIHtcbiAgICAgICAgb2xkUG9zICs9IGNvbXBvbmVudC5jb3VudDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29tcG9uZW50LnZhbHVlID0gb2xkU3RyaW5nLnNsaWNlKG9sZFBvcywgb2xkUG9zICsgY29tcG9uZW50LmNvdW50KS5qb2luKCcnKTtcbiAgICAgIG9sZFBvcyArPSBjb21wb25lbnQuY291bnQ7XG5cbiAgICAgIC8vIFJldmVyc2UgYWRkIGFuZCByZW1vdmUgc28gcmVtb3ZlcyBhcmUgb3V0cHV0IGZpcnN0IHRvIG1hdGNoIGNvbW1vbiBjb252ZW50aW9uXG4gICAgICAvLyBUaGUgZGlmZmluZyBhbGdvcml0aG0gaXMgdGllZCB0byBhZGQgdGhlbiByZW1vdmUgb3V0cHV0IGFuZCB0aGlzIGlzIHRoZSBzaW1wbGVzdFxuICAgICAgLy8gcm91dGUgdG8gZ2V0IHRoZSBkZXNpcmVkIG91dHB1dCB3aXRoIG1pbmltYWwgb3ZlcmhlYWQuXG4gICAgICBpZiAoY29tcG9uZW50UG9zICYmIGNvbXBvbmVudHNbY29tcG9uZW50UG9zIC0gMV0uYWRkZWQpIHtcbiAgICAgICAgbGV0IHRtcCA9IGNvbXBvbmVudHNbY29tcG9uZW50UG9zIC0gMV07XG4gICAgICAgIGNvbXBvbmVudHNbY29tcG9uZW50UG9zIC0gMV0gPSBjb21wb25lbnRzW2NvbXBvbmVudFBvc107XG4gICAgICAgIGNvbXBvbmVudHNbY29tcG9uZW50UG9zXSA9IHRtcDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBTcGVjaWFsIGNhc2UgaGFuZGxlIGZvciB3aGVuIG9uZSB0ZXJtaW5hbCBpcyBpZ25vcmVkLiBGb3IgdGhpcyBjYXNlIHdlIG1lcmdlIHRoZVxuICAvLyB0ZXJtaW5hbCBpbnRvIHRoZSBwcmlvciBzdHJpbmcgYW5kIGRyb3AgdGhlIGNoYW5nZS5cbiAgbGV0IGxhc3RDb21wb25lbnQgPSBjb21wb25lbnRzW2NvbXBvbmVudExlbiAtIDFdO1xuICBpZiAoY29tcG9uZW50TGVuID4gMVxuICAgICAgJiYgKGxhc3RDb21wb25lbnQuYWRkZWQgfHwgbGFzdENvbXBvbmVudC5yZW1vdmVkKVxuICAgICAgJiYgZGlmZi5lcXVhbHMoJycsIGxhc3RDb21wb25lbnQudmFsdWUpKSB7XG4gICAgY29tcG9uZW50c1tjb21wb25lbnRMZW4gLSAyXS52YWx1ZSArPSBsYXN0Q29tcG9uZW50LnZhbHVlO1xuICAgIGNvbXBvbmVudHMucG9wKCk7XG4gIH1cblxuICByZXR1cm4gY29tcG9uZW50cztcbn1cblxuZnVuY3Rpb24gY2xvbmVQYXRoKHBhdGgpIHtcbiAgcmV0dXJuIHsgbmV3UG9zOiBwYXRoLm5ld1BvcywgY29tcG9uZW50czogcGF0aC5jb21wb25lbnRzLnNsaWNlKDApIH07XG59XG4iLCJpbXBvcnQgRGlmZiBmcm9tICcuL2Jhc2UnO1xuXG5leHBvcnQgY29uc3QgY2hhcmFjdGVyRGlmZiA9IG5ldyBEaWZmKCk7XG5leHBvcnQgZnVuY3Rpb24gZGlmZkNoYXJzKG9sZFN0ciwgbmV3U3RyLCBjYWxsYmFjaykgeyByZXR1cm4gY2hhcmFjdGVyRGlmZi5kaWZmKG9sZFN0ciwgbmV3U3RyLCBjYWxsYmFjayk7IH1cbiIsImltcG9ydCBEaWZmIGZyb20gJy4vYmFzZSc7XG5cbmV4cG9ydCBjb25zdCBjc3NEaWZmID0gbmV3IERpZmYoKTtcbmNzc0RpZmYudG9rZW5pemUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUuc3BsaXQoLyhbe306OyxdfFxccyspLyk7XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZGlmZkNzcyhvbGRTdHIsIG5ld1N0ciwgY2FsbGJhY2spIHsgcmV0dXJuIGNzc0RpZmYuZGlmZihvbGRTdHIsIG5ld1N0ciwgY2FsbGJhY2spOyB9XG4iLCJpbXBvcnQgRGlmZiBmcm9tICcuL2Jhc2UnO1xuaW1wb3J0IHtsaW5lRGlmZn0gZnJvbSAnLi9saW5lJztcblxuY29uc3Qgb2JqZWN0UHJvdG90eXBlVG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG5cbmV4cG9ydCBjb25zdCBqc29uRGlmZiA9IG5ldyBEaWZmKCk7XG4vLyBEaXNjcmltaW5hdGUgYmV0d2VlbiB0d28gbGluZXMgb2YgcHJldHR5LXByaW50ZWQsIHNlcmlhbGl6ZWQgSlNPTiB3aGVyZSBvbmUgb2YgdGhlbSBoYXMgYVxuLy8gZGFuZ2xpbmcgY29tbWEgYW5kIHRoZSBvdGhlciBkb2Vzbid0LiBUdXJucyBvdXQgaW5jbHVkaW5nIHRoZSBkYW5nbGluZyBjb21tYSB5aWVsZHMgdGhlIG5pY2VzdCBvdXRwdXQ6XG5qc29uRGlmZi51c2VMb25nZXN0VG9rZW4gPSB0cnVlO1xuXG5qc29uRGlmZi50b2tlbml6ZSA9IGxpbmVEaWZmLnRva2VuaXplO1xuanNvbkRpZmYuY2FzdElucHV0ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyB2YWx1ZSA6IEpTT04uc3RyaW5naWZ5KGNhbm9uaWNhbGl6ZSh2YWx1ZSksIHVuZGVmaW5lZCwgJyAgJyk7XG59O1xuanNvbkRpZmYuZXF1YWxzID0gZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgcmV0dXJuIERpZmYucHJvdG90eXBlLmVxdWFscyhsZWZ0LnJlcGxhY2UoLywoW1xcclxcbl0pL2csICckMScpLCByaWdodC5yZXBsYWNlKC8sKFtcXHJcXG5dKS9nLCAnJDEnKSk7XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZGlmZkpzb24ob2xkT2JqLCBuZXdPYmosIGNhbGxiYWNrKSB7IHJldHVybiBqc29uRGlmZi5kaWZmKG9sZE9iaiwgbmV3T2JqLCBjYWxsYmFjayk7IH1cblxuXG4vLyBUaGlzIGZ1bmN0aW9uIGhhbmRsZXMgdGhlIHByZXNlbmNlIG9mIGNpcmN1bGFyIHJlZmVyZW5jZXMgYnkgYmFpbGluZyBvdXQgd2hlbiBlbmNvdW50ZXJpbmcgYW5cbi8vIG9iamVjdCB0aGF0IGlzIGFscmVhZHkgb24gdGhlIFwic3RhY2tcIiBvZiBpdGVtcyBiZWluZyBwcm9jZXNzZWQuXG5leHBvcnQgZnVuY3Rpb24gY2Fub25pY2FsaXplKG9iaiwgc3RhY2ssIHJlcGxhY2VtZW50U3RhY2spIHtcbiAgc3RhY2sgPSBzdGFjayB8fCBbXTtcbiAgcmVwbGFjZW1lbnRTdGFjayA9IHJlcGxhY2VtZW50U3RhY2sgfHwgW107XG5cbiAgbGV0IGk7XG5cbiAgZm9yIChpID0gMDsgaSA8IHN0YWNrLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgaWYgKHN0YWNrW2ldID09PSBvYmopIHtcbiAgICAgIHJldHVybiByZXBsYWNlbWVudFN0YWNrW2ldO1xuICAgIH1cbiAgfVxuXG4gIGxldCBjYW5vbmljYWxpemVkT2JqO1xuXG4gIGlmICgnW29iamVjdCBBcnJheV0nID09PSBvYmplY3RQcm90b3R5cGVUb1N0cmluZy5jYWxsKG9iaikpIHtcbiAgICBzdGFjay5wdXNoKG9iaik7XG4gICAgY2Fub25pY2FsaXplZE9iaiA9IG5ldyBBcnJheShvYmoubGVuZ3RoKTtcbiAgICByZXBsYWNlbWVudFN0YWNrLnB1c2goY2Fub25pY2FsaXplZE9iaik7XG4gICAgZm9yIChpID0gMDsgaSA8IG9iai5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgY2Fub25pY2FsaXplZE9ialtpXSA9IGNhbm9uaWNhbGl6ZShvYmpbaV0sIHN0YWNrLCByZXBsYWNlbWVudFN0YWNrKTtcbiAgICB9XG4gICAgc3RhY2sucG9wKCk7XG4gICAgcmVwbGFjZW1lbnRTdGFjay5wb3AoKTtcbiAgICByZXR1cm4gY2Fub25pY2FsaXplZE9iajtcbiAgfVxuXG4gIGlmIChvYmogJiYgb2JqLnRvSlNPTikge1xuICAgIG9iaiA9IG9iai50b0pTT04oKTtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0JyAmJiBvYmogIT09IG51bGwpIHtcbiAgICBzdGFjay5wdXNoKG9iaik7XG4gICAgY2Fub25pY2FsaXplZE9iaiA9IHt9O1xuICAgIHJlcGxhY2VtZW50U3RhY2sucHVzaChjYW5vbmljYWxpemVkT2JqKTtcbiAgICBsZXQgc29ydGVkS2V5cyA9IFtdLFxuICAgICAgICBrZXk7XG4gICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgIHNvcnRlZEtleXMucHVzaChrZXkpO1xuICAgICAgfVxuICAgIH1cbiAgICBzb3J0ZWRLZXlzLnNvcnQoKTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgc29ydGVkS2V5cy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAga2V5ID0gc29ydGVkS2V5c1tpXTtcbiAgICAgIGNhbm9uaWNhbGl6ZWRPYmpba2V5XSA9IGNhbm9uaWNhbGl6ZShvYmpba2V5XSwgc3RhY2ssIHJlcGxhY2VtZW50U3RhY2spO1xuICAgIH1cbiAgICBzdGFjay5wb3AoKTtcbiAgICByZXBsYWNlbWVudFN0YWNrLnBvcCgpO1xuICB9IGVsc2Uge1xuICAgIGNhbm9uaWNhbGl6ZWRPYmogPSBvYmo7XG4gIH1cbiAgcmV0dXJuIGNhbm9uaWNhbGl6ZWRPYmo7XG59XG4iLCJpbXBvcnQgRGlmZiBmcm9tICcuL2Jhc2UnO1xuaW1wb3J0IHtnZW5lcmF0ZU9wdGlvbnN9IGZyb20gJy4uL3V0aWwvcGFyYW1zJztcblxuZXhwb3J0IGNvbnN0IGxpbmVEaWZmID0gbmV3IERpZmYoKTtcbmxpbmVEaWZmLnRva2VuaXplID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgbGV0IHJldExpbmVzID0gW10sXG4gICAgICBsaW5lc0FuZE5ld2xpbmVzID0gdmFsdWUuc3BsaXQoLyhcXG58XFxyXFxuKS8pO1xuXG4gIC8vIElnbm9yZSB0aGUgZmluYWwgZW1wdHkgdG9rZW4gdGhhdCBvY2N1cnMgaWYgdGhlIHN0cmluZyBlbmRzIHdpdGggYSBuZXcgbGluZVxuICBpZiAoIWxpbmVzQW5kTmV3bGluZXNbbGluZXNBbmROZXdsaW5lcy5sZW5ndGggLSAxXSkge1xuICAgIGxpbmVzQW5kTmV3bGluZXMucG9wKCk7XG4gIH1cblxuICAvLyBNZXJnZSB0aGUgY29udGVudCBhbmQgbGluZSBzZXBhcmF0b3JzIGludG8gc2luZ2xlIHRva2Vuc1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzQW5kTmV3bGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICBsZXQgbGluZSA9IGxpbmVzQW5kTmV3bGluZXNbaV07XG5cbiAgICBpZiAoaSAlIDIgJiYgIXRoaXMub3B0aW9ucy5uZXdsaW5lSXNUb2tlbikge1xuICAgICAgcmV0TGluZXNbcmV0TGluZXMubGVuZ3RoIC0gMV0gKz0gbGluZTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy5pZ25vcmVXaGl0ZXNwYWNlKSB7XG4gICAgICAgIGxpbmUgPSBsaW5lLnRyaW0oKTtcbiAgICAgIH1cbiAgICAgIHJldExpbmVzLnB1c2gobGluZSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJldExpbmVzO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRpZmZMaW5lcyhvbGRTdHIsIG5ld1N0ciwgY2FsbGJhY2spIHsgcmV0dXJuIGxpbmVEaWZmLmRpZmYob2xkU3RyLCBuZXdTdHIsIGNhbGxiYWNrKTsgfVxuZXhwb3J0IGZ1bmN0aW9uIGRpZmZUcmltbWVkTGluZXMob2xkU3RyLCBuZXdTdHIsIGNhbGxiYWNrKSB7XG4gIGxldCBvcHRpb25zID0gZ2VuZXJhdGVPcHRpb25zKGNhbGxiYWNrLCB7aWdub3JlV2hpdGVzcGFjZTogdHJ1ZX0pO1xuICByZXR1cm4gbGluZURpZmYuZGlmZihvbGRTdHIsIG5ld1N0ciwgb3B0aW9ucyk7XG59XG4iLCJpbXBvcnQgRGlmZiBmcm9tICcuL2Jhc2UnO1xuXG5cbmV4cG9ydCBjb25zdCBzZW50ZW5jZURpZmYgPSBuZXcgRGlmZigpO1xuc2VudGVuY2VEaWZmLnRva2VuaXplID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlLnNwbGl0KC8oXFxTLis/Wy4hP10pKD89XFxzK3wkKS8pO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRpZmZTZW50ZW5jZXMob2xkU3RyLCBuZXdTdHIsIGNhbGxiYWNrKSB7IHJldHVybiBzZW50ZW5jZURpZmYuZGlmZihvbGRTdHIsIG5ld1N0ciwgY2FsbGJhY2spOyB9XG4iLCJpbXBvcnQgRGlmZiBmcm9tICcuL2Jhc2UnO1xuaW1wb3J0IHtnZW5lcmF0ZU9wdGlvbnN9IGZyb20gJy4uL3V0aWwvcGFyYW1zJztcblxuLy8gQmFzZWQgb24gaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvTGF0aW5fc2NyaXB0X2luX1VuaWNvZGVcbi8vXG4vLyBSYW5nZXMgYW5kIGV4Y2VwdGlvbnM6XG4vLyBMYXRpbi0xIFN1cHBsZW1lbnQsIDAwODDigJMwMEZGXG4vLyAgLSBVKzAwRDcgIMOXIE11bHRpcGxpY2F0aW9uIHNpZ25cbi8vICAtIFUrMDBGNyAgw7cgRGl2aXNpb24gc2lnblxuLy8gTGF0aW4gRXh0ZW5kZWQtQSwgMDEwMOKAkzAxN0Zcbi8vIExhdGluIEV4dGVuZGVkLUIsIDAxODDigJMwMjRGXG4vLyBJUEEgRXh0ZW5zaW9ucywgMDI1MOKAkzAyQUZcbi8vIFNwYWNpbmcgTW9kaWZpZXIgTGV0dGVycywgMDJCMOKAkzAyRkZcbi8vICAtIFUrMDJDNyAgy4cgJiM3MTE7ICBDYXJvblxuLy8gIC0gVSswMkQ4ICDLmCAmIzcyODsgIEJyZXZlXG4vLyAgLSBVKzAyRDkgIMuZICYjNzI5OyAgRG90IEFib3ZlXG4vLyAgLSBVKzAyREEgIMuaICYjNzMwOyAgUmluZyBBYm92ZVxuLy8gIC0gVSswMkRCICDLmyAmIzczMTsgIE9nb25la1xuLy8gIC0gVSswMkRDICDLnCAmIzczMjsgIFNtYWxsIFRpbGRlXG4vLyAgLSBVKzAyREQgIMudICYjNzMzOyAgRG91YmxlIEFjdXRlIEFjY2VudFxuLy8gTGF0aW4gRXh0ZW5kZWQgQWRkaXRpb25hbCwgMUUwMOKAkzFFRkZcbmNvbnN0IGV4dGVuZGVkV29yZENoYXJzID0gL15bYS16QS1aXFx1e0MwfS1cXHV7RkZ9XFx1e0Q4fS1cXHV7RjZ9XFx1e0Y4fS1cXHV7MkM2fVxcdXsyQzh9LVxcdXsyRDd9XFx1ezJERX0tXFx1ezJGRn1cXHV7MUUwMH0tXFx1ezFFRkZ9XSskL3U7XG5cbmNvbnN0IHJlV2hpdGVzcGFjZSA9IC9cXFMvO1xuXG5leHBvcnQgY29uc3Qgd29yZERpZmYgPSBuZXcgRGlmZigpO1xud29yZERpZmYuZXF1YWxzID0gZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgcmV0dXJuIGxlZnQgPT09IHJpZ2h0IHx8ICh0aGlzLm9wdGlvbnMuaWdub3JlV2hpdGVzcGFjZSAmJiAhcmVXaGl0ZXNwYWNlLnRlc3QobGVmdCkgJiYgIXJlV2hpdGVzcGFjZS50ZXN0KHJpZ2h0KSk7XG59O1xud29yZERpZmYudG9rZW5pemUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICBsZXQgdG9rZW5zID0gdmFsdWUuc3BsaXQoLyhcXHMrfFxcYikvKTtcblxuICAvLyBKb2luIHRoZSBib3VuZGFyeSBzcGxpdHMgdGhhdCB3ZSBkbyBub3QgY29uc2lkZXIgdG8gYmUgYm91bmRhcmllcy4gVGhpcyBpcyBwcmltYXJpbHkgdGhlIGV4dGVuZGVkIExhdGluIGNoYXJhY3RlciBzZXQuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdG9rZW5zLmxlbmd0aCAtIDE7IGkrKykge1xuICAgIC8vIElmIHdlIGhhdmUgYW4gZW1wdHkgc3RyaW5nIGluIHRoZSBuZXh0IGZpZWxkIGFuZCB3ZSBoYXZlIG9ubHkgd29yZCBjaGFycyBiZWZvcmUgYW5kIGFmdGVyLCBtZXJnZVxuICAgIGlmICghdG9rZW5zW2kgKyAxXSAmJiB0b2tlbnNbaSArIDJdXG4gICAgICAgICAgJiYgZXh0ZW5kZWRXb3JkQ2hhcnMudGVzdCh0b2tlbnNbaV0pXG4gICAgICAgICAgJiYgZXh0ZW5kZWRXb3JkQ2hhcnMudGVzdCh0b2tlbnNbaSArIDJdKSkge1xuICAgICAgdG9rZW5zW2ldICs9IHRva2Vuc1tpICsgMl07XG4gICAgICB0b2tlbnMuc3BsaWNlKGkgKyAxLCAyKTtcbiAgICAgIGktLTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdG9rZW5zO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRpZmZXb3JkcyhvbGRTdHIsIG5ld1N0ciwgY2FsbGJhY2spIHtcbiAgbGV0IG9wdGlvbnMgPSBnZW5lcmF0ZU9wdGlvbnMoY2FsbGJhY2ssIHtpZ25vcmVXaGl0ZXNwYWNlOiB0cnVlfSk7XG4gIHJldHVybiB3b3JkRGlmZi5kaWZmKG9sZFN0ciwgbmV3U3RyLCBvcHRpb25zKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBkaWZmV29yZHNXaXRoU3BhY2Uob2xkU3RyLCBuZXdTdHIsIGNhbGxiYWNrKSB7XG4gIHJldHVybiB3b3JkRGlmZi5kaWZmKG9sZFN0ciwgbmV3U3RyLCBjYWxsYmFjayk7XG59XG4iLCIvKiBTZWUgTElDRU5TRSBmaWxlIGZvciB0ZXJtcyBvZiB1c2UgKi9cblxuLypcbiAqIFRleHQgZGlmZiBpbXBsZW1lbnRhdGlvbi5cbiAqXG4gKiBUaGlzIGxpYnJhcnkgc3VwcG9ydHMgdGhlIGZvbGxvd2luZyBBUElTOlxuICogSnNEaWZmLmRpZmZDaGFyczogQ2hhcmFjdGVyIGJ5IGNoYXJhY3RlciBkaWZmXG4gKiBKc0RpZmYuZGlmZldvcmRzOiBXb3JkIChhcyBkZWZpbmVkIGJ5IFxcYiByZWdleCkgZGlmZiB3aGljaCBpZ25vcmVzIHdoaXRlc3BhY2VcbiAqIEpzRGlmZi5kaWZmTGluZXM6IExpbmUgYmFzZWQgZGlmZlxuICpcbiAqIEpzRGlmZi5kaWZmQ3NzOiBEaWZmIHRhcmdldGVkIGF0IENTUyBjb250ZW50XG4gKlxuICogVGhlc2UgbWV0aG9kcyBhcmUgYmFzZWQgb24gdGhlIGltcGxlbWVudGF0aW9uIHByb3Bvc2VkIGluXG4gKiBcIkFuIE8oTkQpIERpZmZlcmVuY2UgQWxnb3JpdGhtIGFuZCBpdHMgVmFyaWF0aW9uc1wiIChNeWVycywgMTk4NikuXG4gKiBodHRwOi8vY2l0ZXNlZXJ4LmlzdC5wc3UuZWR1L3ZpZXdkb2Mvc3VtbWFyeT9kb2k9MTAuMS4xLjQuNjkyN1xuICovXG5pbXBvcnQgRGlmZiBmcm9tICcuL2RpZmYvYmFzZSc7XG5pbXBvcnQge2RpZmZDaGFyc30gZnJvbSAnLi9kaWZmL2NoYXJhY3Rlcic7XG5pbXBvcnQge2RpZmZXb3JkcywgZGlmZldvcmRzV2l0aFNwYWNlfSBmcm9tICcuL2RpZmYvd29yZCc7XG5pbXBvcnQge2RpZmZMaW5lcywgZGlmZlRyaW1tZWRMaW5lc30gZnJvbSAnLi9kaWZmL2xpbmUnO1xuaW1wb3J0IHtkaWZmU2VudGVuY2VzfSBmcm9tICcuL2RpZmYvc2VudGVuY2UnO1xuXG5pbXBvcnQge2RpZmZDc3N9IGZyb20gJy4vZGlmZi9jc3MnO1xuaW1wb3J0IHtkaWZmSnNvbiwgY2Fub25pY2FsaXplfSBmcm9tICcuL2RpZmYvanNvbic7XG5cbmltcG9ydCB7YXBwbHlQYXRjaCwgYXBwbHlQYXRjaGVzfSBmcm9tICcuL3BhdGNoL2FwcGx5JztcbmltcG9ydCB7cGFyc2VQYXRjaH0gZnJvbSAnLi9wYXRjaC9wYXJzZSc7XG5pbXBvcnQge3N0cnVjdHVyZWRQYXRjaCwgY3JlYXRlVHdvRmlsZXNQYXRjaCwgY3JlYXRlUGF0Y2h9IGZyb20gJy4vcGF0Y2gvY3JlYXRlJztcblxuaW1wb3J0IHtjb252ZXJ0Q2hhbmdlc1RvRE1QfSBmcm9tICcuL2NvbnZlcnQvZG1wJztcbmltcG9ydCB7Y29udmVydENoYW5nZXNUb1hNTH0gZnJvbSAnLi9jb252ZXJ0L3htbCc7XG5cbmV4cG9ydCB7XG4gIERpZmYsXG5cbiAgZGlmZkNoYXJzLFxuICBkaWZmV29yZHMsXG4gIGRpZmZXb3Jkc1dpdGhTcGFjZSxcbiAgZGlmZkxpbmVzLFxuICBkaWZmVHJpbW1lZExpbmVzLFxuICBkaWZmU2VudGVuY2VzLFxuXG4gIGRpZmZDc3MsXG4gIGRpZmZKc29uLFxuXG4gIHN0cnVjdHVyZWRQYXRjaCxcbiAgY3JlYXRlVHdvRmlsZXNQYXRjaCxcbiAgY3JlYXRlUGF0Y2gsXG4gIGFwcGx5UGF0Y2gsXG4gIGFwcGx5UGF0Y2hlcyxcbiAgcGFyc2VQYXRjaCxcbiAgY29udmVydENoYW5nZXNUb0RNUCxcbiAgY29udmVydENoYW5nZXNUb1hNTCxcbiAgY2Fub25pY2FsaXplXG59O1xuIiwiaW1wb3J0IHtwYXJzZVBhdGNofSBmcm9tICcuL3BhcnNlJztcbmltcG9ydCBkaXN0YW5jZUl0ZXJhdG9yIGZyb20gJy4uL3V0aWwvZGlzdGFuY2UtaXRlcmF0b3InO1xuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlQYXRjaChzb3VyY2UsIHVuaURpZmYsIG9wdGlvbnMgPSB7fSkge1xuICBpZiAodHlwZW9mIHVuaURpZmYgPT09ICdzdHJpbmcnKSB7XG4gICAgdW5pRGlmZiA9IHBhcnNlUGF0Y2godW5pRGlmZik7XG4gIH1cblxuICBpZiAoQXJyYXkuaXNBcnJheSh1bmlEaWZmKSkge1xuICAgIGlmICh1bmlEaWZmLmxlbmd0aCA+IDEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignYXBwbHlQYXRjaCBvbmx5IHdvcmtzIHdpdGggYSBzaW5nbGUgaW5wdXQuJyk7XG4gICAgfVxuXG4gICAgdW5pRGlmZiA9IHVuaURpZmZbMF07XG4gIH1cblxuICAvLyBBcHBseSB0aGUgZGlmZiB0byB0aGUgaW5wdXRcbiAgbGV0IGxpbmVzID0gc291cmNlLnNwbGl0KCdcXG4nKSxcbiAgICAgIGh1bmtzID0gdW5pRGlmZi5odW5rcyxcblxuICAgICAgY29tcGFyZUxpbmUgPSBvcHRpb25zLmNvbXBhcmVMaW5lIHx8ICgobGluZU51bWJlciwgbGluZSwgb3BlcmF0aW9uLCBwYXRjaENvbnRlbnQpID0+IGxpbmUgPT09IHBhdGNoQ29udGVudCksXG4gICAgICBlcnJvckNvdW50ID0gMCxcbiAgICAgIGZ1enpGYWN0b3IgPSBvcHRpb25zLmZ1enpGYWN0b3IgfHwgMCxcbiAgICAgIG1pbkxpbmUgPSAwLFxuICAgICAgb2Zmc2V0ID0gMCxcblxuICAgICAgcmVtb3ZlRU9GTkwsXG4gICAgICBhZGRFT0ZOTDtcblxuICAvKipcbiAgICogQ2hlY2tzIGlmIHRoZSBodW5rIGV4YWN0bHkgZml0cyBvbiB0aGUgcHJvdmlkZWQgbG9jYXRpb25cbiAgICovXG4gIGZ1bmN0aW9uIGh1bmtGaXRzKGh1bmssIHRvUG9zKSB7XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBodW5rLmxpbmVzLmxlbmd0aDsgaisrKSB7XG4gICAgICBsZXQgbGluZSA9IGh1bmsubGluZXNbal0sXG4gICAgICAgICAgb3BlcmF0aW9uID0gbGluZVswXSxcbiAgICAgICAgICBjb250ZW50ID0gbGluZS5zdWJzdHIoMSk7XG5cbiAgICAgIGlmIChvcGVyYXRpb24gPT09ICcgJyB8fCBvcGVyYXRpb24gPT09ICctJykge1xuICAgICAgICAvLyBDb250ZXh0IHNhbml0eSBjaGVja1xuICAgICAgICBpZiAoIWNvbXBhcmVMaW5lKHRvUG9zICsgMSwgbGluZXNbdG9Qb3NdLCBvcGVyYXRpb24sIGNvbnRlbnQpKSB7XG4gICAgICAgICAgZXJyb3JDb3VudCsrO1xuXG4gICAgICAgICAgaWYgKGVycm9yQ291bnQgPiBmdXp6RmFjdG9yKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRvUG9zKys7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBTZWFyY2ggYmVzdCBmaXQgb2Zmc2V0cyBmb3IgZWFjaCBodW5rIGJhc2VkIG9uIHRoZSBwcmV2aW91cyBvbmVzXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgaHVua3MubGVuZ3RoOyBpKyspIHtcbiAgICBsZXQgaHVuayA9IGh1bmtzW2ldLFxuICAgICAgICBtYXhMaW5lID0gbGluZXMubGVuZ3RoIC0gaHVuay5vbGRMaW5lcyxcbiAgICAgICAgbG9jYWxPZmZzZXQgPSAwLFxuICAgICAgICB0b1BvcyA9IG9mZnNldCArIGh1bmsub2xkU3RhcnQgLSAxO1xuXG4gICAgbGV0IGl0ZXJhdG9yID0gZGlzdGFuY2VJdGVyYXRvcih0b1BvcywgbWluTGluZSwgbWF4TGluZSk7XG5cbiAgICBmb3IgKDsgbG9jYWxPZmZzZXQgIT09IHVuZGVmaW5lZDsgbG9jYWxPZmZzZXQgPSBpdGVyYXRvcigpKSB7XG4gICAgICBpZiAoaHVua0ZpdHMoaHVuaywgdG9Qb3MgKyBsb2NhbE9mZnNldCkpIHtcbiAgICAgICAgaHVuay5vZmZzZXQgPSBvZmZzZXQgKz0gbG9jYWxPZmZzZXQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChsb2NhbE9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gU2V0IGxvd2VyIHRleHQgbGltaXQgdG8gZW5kIG9mIHRoZSBjdXJyZW50IGh1bmssIHNvIG5leHQgb25lcyBkb24ndCB0cnlcbiAgICAvLyB0byBmaXQgb3ZlciBhbHJlYWR5IHBhdGNoZWQgdGV4dFxuICAgIG1pbkxpbmUgPSBodW5rLm9mZnNldCArIGh1bmsub2xkU3RhcnQgKyBodW5rLm9sZExpbmVzO1xuICB9XG5cbiAgLy8gQXBwbHkgcGF0Y2ggaHVua3NcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBodW5rcy5sZW5ndGg7IGkrKykge1xuICAgIGxldCBodW5rID0gaHVua3NbaV0sXG4gICAgICAgIHRvUG9zID0gaHVuay5vZmZzZXQgKyBodW5rLm5ld1N0YXJ0IC0gMTtcbiAgICBpZiAoaHVuay5uZXdMaW5lcyA9PSAwKSB7IHRvUG9zKys7IH1cblxuICAgIGZvciAobGV0IGogPSAwOyBqIDwgaHVuay5saW5lcy5sZW5ndGg7IGorKykge1xuICAgICAgbGV0IGxpbmUgPSBodW5rLmxpbmVzW2pdLFxuICAgICAgICAgIG9wZXJhdGlvbiA9IGxpbmVbMF0sXG4gICAgICAgICAgY29udGVudCA9IGxpbmUuc3Vic3RyKDEpO1xuXG4gICAgICBpZiAob3BlcmF0aW9uID09PSAnICcpIHtcbiAgICAgICAgdG9Qb3MrKztcbiAgICAgIH0gZWxzZSBpZiAob3BlcmF0aW9uID09PSAnLScpIHtcbiAgICAgICAgbGluZXMuc3BsaWNlKHRvUG9zLCAxKTtcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgICB9IGVsc2UgaWYgKG9wZXJhdGlvbiA9PT0gJysnKSB7XG4gICAgICAgIGxpbmVzLnNwbGljZSh0b1BvcywgMCwgY29udGVudCk7XG4gICAgICAgIHRvUG9zKys7XG4gICAgICB9IGVsc2UgaWYgKG9wZXJhdGlvbiA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGxldCBwcmV2aW91c09wZXJhdGlvbiA9IGh1bmsubGluZXNbaiAtIDFdID8gaHVuay5saW5lc1tqIC0gMV1bMF0gOiBudWxsO1xuICAgICAgICBpZiAocHJldmlvdXNPcGVyYXRpb24gPT09ICcrJykge1xuICAgICAgICAgIHJlbW92ZUVPRk5MID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChwcmV2aW91c09wZXJhdGlvbiA9PT0gJy0nKSB7XG4gICAgICAgICAgYWRkRU9GTkwgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gSGFuZGxlIEVPRk5MIGluc2VydGlvbi9yZW1vdmFsXG4gIGlmIChyZW1vdmVFT0ZOTCkge1xuICAgIHdoaWxlICghbGluZXNbbGluZXMubGVuZ3RoIC0gMV0pIHtcbiAgICAgIGxpbmVzLnBvcCgpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhZGRFT0ZOTCkge1xuICAgIGxpbmVzLnB1c2goJycpO1xuICB9XG4gIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKTtcbn1cblxuLy8gV3JhcHBlciB0aGF0IHN1cHBvcnRzIG11bHRpcGxlIGZpbGUgcGF0Y2hlcyB2aWEgY2FsbGJhY2tzLlxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5UGF0Y2hlcyh1bmlEaWZmLCBvcHRpb25zKSB7XG4gIGlmICh0eXBlb2YgdW5pRGlmZiA9PT0gJ3N0cmluZycpIHtcbiAgICB1bmlEaWZmID0gcGFyc2VQYXRjaCh1bmlEaWZmKTtcbiAgfVxuXG4gIGxldCBjdXJyZW50SW5kZXggPSAwO1xuICBmdW5jdGlvbiBwcm9jZXNzSW5kZXgoKSB7XG4gICAgbGV0IGluZGV4ID0gdW5pRGlmZltjdXJyZW50SW5kZXgrK107XG4gICAgaWYgKCFpbmRleCkge1xuICAgICAgcmV0dXJuIG9wdGlvbnMuY29tcGxldGUoKTtcbiAgICB9XG5cbiAgICBvcHRpb25zLmxvYWRGaWxlKGluZGV4LCBmdW5jdGlvbihlcnIsIGRhdGEpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMuY29tcGxldGUoZXJyKTtcbiAgICAgIH1cblxuICAgICAgbGV0IHVwZGF0ZWRDb250ZW50ID0gYXBwbHlQYXRjaChkYXRhLCBpbmRleCwgb3B0aW9ucyk7XG4gICAgICBvcHRpb25zLnBhdGNoZWQoaW5kZXgsIHVwZGF0ZWRDb250ZW50LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJldHVybiBvcHRpb25zLmNvbXBsZXRlKGVycik7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9jZXNzSW5kZXgoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHByb2Nlc3NJbmRleCgpO1xufVxuIiwiaW1wb3J0IHtkaWZmTGluZXN9IGZyb20gJy4uL2RpZmYvbGluZSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHJ1Y3R1cmVkUGF0Y2gob2xkRmlsZU5hbWUsIG5ld0ZpbGVOYW1lLCBvbGRTdHIsIG5ld1N0ciwgb2xkSGVhZGVyLCBuZXdIZWFkZXIsIG9wdGlvbnMpIHtcbiAgaWYgKCFvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IHsgY29udGV4dDogNCB9O1xuICB9XG5cbiAgY29uc3QgZGlmZiA9IGRpZmZMaW5lcyhvbGRTdHIsIG5ld1N0cik7XG4gIGRpZmYucHVzaCh7dmFsdWU6ICcnLCBsaW5lczogW119KTsgICAvLyBBcHBlbmQgYW4gZW1wdHkgdmFsdWUgdG8gbWFrZSBjbGVhbnVwIGVhc2llclxuXG4gIGZ1bmN0aW9uIGNvbnRleHRMaW5lcyhsaW5lcykge1xuICAgIHJldHVybiBsaW5lcy5tYXAoZnVuY3Rpb24oZW50cnkpIHsgcmV0dXJuICcgJyArIGVudHJ5OyB9KTtcbiAgfVxuXG4gIGxldCBodW5rcyA9IFtdO1xuICBsZXQgb2xkUmFuZ2VTdGFydCA9IDAsIG5ld1JhbmdlU3RhcnQgPSAwLCBjdXJSYW5nZSA9IFtdLFxuICAgICAgb2xkTGluZSA9IDEsIG5ld0xpbmUgPSAxO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGRpZmYubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjdXJyZW50ID0gZGlmZltpXSxcbiAgICAgICAgICBsaW5lcyA9IGN1cnJlbnQubGluZXMgfHwgY3VycmVudC52YWx1ZS5yZXBsYWNlKC9cXG4kLywgJycpLnNwbGl0KCdcXG4nKTtcbiAgICBjdXJyZW50LmxpbmVzID0gbGluZXM7XG5cbiAgICBpZiAoY3VycmVudC5hZGRlZCB8fCBjdXJyZW50LnJlbW92ZWQpIHtcbiAgICAgIC8vIElmIHdlIGhhdmUgcHJldmlvdXMgY29udGV4dCwgc3RhcnQgd2l0aCB0aGF0XG4gICAgICBpZiAoIW9sZFJhbmdlU3RhcnQpIHtcbiAgICAgICAgY29uc3QgcHJldiA9IGRpZmZbaSAtIDFdO1xuICAgICAgICBvbGRSYW5nZVN0YXJ0ID0gb2xkTGluZTtcbiAgICAgICAgbmV3UmFuZ2VTdGFydCA9IG5ld0xpbmU7XG5cbiAgICAgICAgaWYgKHByZXYpIHtcbiAgICAgICAgICBjdXJSYW5nZSA9IG9wdGlvbnMuY29udGV4dCA+IDAgPyBjb250ZXh0TGluZXMocHJldi5saW5lcy5zbGljZSgtb3B0aW9ucy5jb250ZXh0KSkgOiBbXTtcbiAgICAgICAgICBvbGRSYW5nZVN0YXJ0IC09IGN1clJhbmdlLmxlbmd0aDtcbiAgICAgICAgICBuZXdSYW5nZVN0YXJ0IC09IGN1clJhbmdlLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBPdXRwdXQgb3VyIGNoYW5nZXNcbiAgICAgIGN1clJhbmdlLnB1c2goLi4uIGxpbmVzLm1hcChmdW5jdGlvbihlbnRyeSkge1xuICAgICAgICByZXR1cm4gKGN1cnJlbnQuYWRkZWQgPyAnKycgOiAnLScpICsgZW50cnk7XG4gICAgICB9KSk7XG5cbiAgICAgIC8vIFRyYWNrIHRoZSB1cGRhdGVkIGZpbGUgcG9zaXRpb25cbiAgICAgIGlmIChjdXJyZW50LmFkZGVkKSB7XG4gICAgICAgIG5ld0xpbmUgKz0gbGluZXMubGVuZ3RoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2xkTGluZSArPSBsaW5lcy5sZW5ndGg7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElkZW50aWNhbCBjb250ZXh0IGxpbmVzLiBUcmFjayBsaW5lIGNoYW5nZXNcbiAgICAgIGlmIChvbGRSYW5nZVN0YXJ0KSB7XG4gICAgICAgIC8vIENsb3NlIG91dCBhbnkgY2hhbmdlcyB0aGF0IGhhdmUgYmVlbiBvdXRwdXQgKG9yIGpvaW4gb3ZlcmxhcHBpbmcpXG4gICAgICAgIGlmIChsaW5lcy5sZW5ndGggPD0gb3B0aW9ucy5jb250ZXh0ICogMiAmJiBpIDwgZGlmZi5sZW5ndGggLSAyKSB7XG4gICAgICAgICAgLy8gT3ZlcmxhcHBpbmdcbiAgICAgICAgICBjdXJSYW5nZS5wdXNoKC4uLiBjb250ZXh0TGluZXMobGluZXMpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBlbmQgdGhlIHJhbmdlIGFuZCBvdXRwdXRcbiAgICAgICAgICBsZXQgY29udGV4dFNpemUgPSBNYXRoLm1pbihsaW5lcy5sZW5ndGgsIG9wdGlvbnMuY29udGV4dCk7XG4gICAgICAgICAgY3VyUmFuZ2UucHVzaCguLi4gY29udGV4dExpbmVzKGxpbmVzLnNsaWNlKDAsIGNvbnRleHRTaXplKSkpO1xuXG4gICAgICAgICAgbGV0IGh1bmsgPSB7XG4gICAgICAgICAgICBvbGRTdGFydDogb2xkUmFuZ2VTdGFydCxcbiAgICAgICAgICAgIG9sZExpbmVzOiAob2xkTGluZSAtIG9sZFJhbmdlU3RhcnQgKyBjb250ZXh0U2l6ZSksXG4gICAgICAgICAgICBuZXdTdGFydDogbmV3UmFuZ2VTdGFydCxcbiAgICAgICAgICAgIG5ld0xpbmVzOiAobmV3TGluZSAtIG5ld1JhbmdlU3RhcnQgKyBjb250ZXh0U2l6ZSksXG4gICAgICAgICAgICBsaW5lczogY3VyUmFuZ2VcbiAgICAgICAgICB9O1xuICAgICAgICAgIGlmIChpID49IGRpZmYubGVuZ3RoIC0gMiAmJiBsaW5lcy5sZW5ndGggPD0gb3B0aW9ucy5jb250ZXh0KSB7XG4gICAgICAgICAgICAvLyBFT0YgaXMgaW5zaWRlIHRoaXMgaHVua1xuICAgICAgICAgICAgbGV0IG9sZEVPRk5ld2xpbmUgPSAoL1xcbiQvLnRlc3Qob2xkU3RyKSk7XG4gICAgICAgICAgICBsZXQgbmV3RU9GTmV3bGluZSA9ICgvXFxuJC8udGVzdChuZXdTdHIpKTtcbiAgICAgICAgICAgIGlmIChsaW5lcy5sZW5ndGggPT0gMCAmJiAhb2xkRU9GTmV3bGluZSkge1xuICAgICAgICAgICAgICAvLyBzcGVjaWFsIGNhc2U6IG9sZCBoYXMgbm8gZW9sIGFuZCBubyB0cmFpbGluZyBjb250ZXh0OyBuby1ubCBjYW4gZW5kIHVwIGJlZm9yZSBhZGRzXG4gICAgICAgICAgICAgIGN1clJhbmdlLnNwbGljZShodW5rLm9sZExpbmVzLCAwLCAnXFxcXCBObyBuZXdsaW5lIGF0IGVuZCBvZiBmaWxlJyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFvbGRFT0ZOZXdsaW5lIHx8ICFuZXdFT0ZOZXdsaW5lKSB7XG4gICAgICAgICAgICAgIGN1clJhbmdlLnB1c2goJ1xcXFwgTm8gbmV3bGluZSBhdCBlbmQgb2YgZmlsZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBodW5rcy5wdXNoKGh1bmspO1xuXG4gICAgICAgICAgb2xkUmFuZ2VTdGFydCA9IDA7XG4gICAgICAgICAgbmV3UmFuZ2VTdGFydCA9IDA7XG4gICAgICAgICAgY3VyUmFuZ2UgPSBbXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgb2xkTGluZSArPSBsaW5lcy5sZW5ndGg7XG4gICAgICBuZXdMaW5lICs9IGxpbmVzLmxlbmd0aDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG9sZEZpbGVOYW1lOiBvbGRGaWxlTmFtZSwgbmV3RmlsZU5hbWU6IG5ld0ZpbGVOYW1lLFxuICAgIG9sZEhlYWRlcjogb2xkSGVhZGVyLCBuZXdIZWFkZXI6IG5ld0hlYWRlcixcbiAgICBodW5rczogaHVua3NcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVR3b0ZpbGVzUGF0Y2gob2xkRmlsZU5hbWUsIG5ld0ZpbGVOYW1lLCBvbGRTdHIsIG5ld1N0ciwgb2xkSGVhZGVyLCBuZXdIZWFkZXIsIG9wdGlvbnMpIHtcbiAgY29uc3QgZGlmZiA9IHN0cnVjdHVyZWRQYXRjaChvbGRGaWxlTmFtZSwgbmV3RmlsZU5hbWUsIG9sZFN0ciwgbmV3U3RyLCBvbGRIZWFkZXIsIG5ld0hlYWRlciwgb3B0aW9ucyk7XG5cbiAgY29uc3QgcmV0ID0gW107XG4gIGlmIChvbGRGaWxlTmFtZSA9PSBuZXdGaWxlTmFtZSkge1xuICAgIHJldC5wdXNoKCdJbmRleDogJyArIG9sZEZpbGVOYW1lKTtcbiAgfVxuICByZXQucHVzaCgnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICByZXQucHVzaCgnLS0tICcgKyBkaWZmLm9sZEZpbGVOYW1lICsgKHR5cGVvZiBkaWZmLm9sZEhlYWRlciA9PT0gJ3VuZGVmaW5lZCcgPyAnJyA6ICdcXHQnICsgZGlmZi5vbGRIZWFkZXIpKTtcbiAgcmV0LnB1c2goJysrKyAnICsgZGlmZi5uZXdGaWxlTmFtZSArICh0eXBlb2YgZGlmZi5uZXdIZWFkZXIgPT09ICd1bmRlZmluZWQnID8gJycgOiAnXFx0JyArIGRpZmYubmV3SGVhZGVyKSk7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBkaWZmLmh1bmtzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgaHVuayA9IGRpZmYuaHVua3NbaV07XG4gICAgcmV0LnB1c2goXG4gICAgICAnQEAgLScgKyBodW5rLm9sZFN0YXJ0ICsgJywnICsgaHVuay5vbGRMaW5lc1xuICAgICAgKyAnICsnICsgaHVuay5uZXdTdGFydCArICcsJyArIGh1bmsubmV3TGluZXNcbiAgICAgICsgJyBAQCdcbiAgICApO1xuICAgIHJldC5wdXNoLmFwcGx5KHJldCwgaHVuay5saW5lcyk7XG4gIH1cblxuICByZXR1cm4gcmV0LmpvaW4oJ1xcbicpICsgJ1xcbic7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQYXRjaChmaWxlTmFtZSwgb2xkU3RyLCBuZXdTdHIsIG9sZEhlYWRlciwgbmV3SGVhZGVyLCBvcHRpb25zKSB7XG4gIHJldHVybiBjcmVhdGVUd29GaWxlc1BhdGNoKGZpbGVOYW1lLCBmaWxlTmFtZSwgb2xkU3RyLCBuZXdTdHIsIG9sZEhlYWRlciwgbmV3SGVhZGVyLCBvcHRpb25zKTtcbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBwYXJzZVBhdGNoKHVuaURpZmYsIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgZGlmZnN0ciA9IHVuaURpZmYuc3BsaXQoJ1xcbicpLFxuICAgICAgbGlzdCA9IFtdLFxuICAgICAgaSA9IDA7XG5cbiAgZnVuY3Rpb24gcGFyc2VJbmRleCgpIHtcbiAgICBsZXQgaW5kZXggPSB7fTtcbiAgICBsaXN0LnB1c2goaW5kZXgpO1xuXG4gICAgLy8gUGFyc2UgZGlmZiBtZXRhZGF0YVxuICAgIHdoaWxlIChpIDwgZGlmZnN0ci5sZW5ndGgpIHtcbiAgICAgIGxldCBsaW5lID0gZGlmZnN0cltpXTtcblxuICAgICAgLy8gRmlsZSBoZWFkZXIgZm91bmQsIGVuZCBwYXJzaW5nIGRpZmYgbWV0YWRhdGFcbiAgICAgIGlmICgvXihcXC1cXC1cXC18XFwrXFwrXFwrfEBAKVxccy8udGVzdChsaW5lKSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgLy8gRGlmZiBpbmRleFxuICAgICAgbGV0IGhlYWRlciA9ICgvXig/OkluZGV4OnxkaWZmKD86IC1yIFxcdyspKylcXHMrKC4rPylcXHMqJC8pLmV4ZWMobGluZSk7XG4gICAgICBpZiAoaGVhZGVyKSB7XG4gICAgICAgIGluZGV4LmluZGV4ID0gaGVhZGVyWzFdO1xuICAgICAgfVxuXG4gICAgICBpKys7XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgZmlsZSBoZWFkZXJzIGlmIHRoZXkgYXJlIGRlZmluZWQuIFVuaWZpZWQgZGlmZiByZXF1aXJlcyB0aGVtLCBidXRcbiAgICAvLyB0aGVyZSdzIG5vIHRlY2huaWNhbCBpc3N1ZXMgdG8gaGF2ZSBhbiBpc29sYXRlZCBodW5rIHdpdGhvdXQgZmlsZSBoZWFkZXJcbiAgICBwYXJzZUZpbGVIZWFkZXIoaW5kZXgpO1xuICAgIHBhcnNlRmlsZUhlYWRlcihpbmRleCk7XG5cbiAgICAvLyBQYXJzZSBodW5rc1xuICAgIGluZGV4Lmh1bmtzID0gW107XG5cbiAgICB3aGlsZSAoaSA8IGRpZmZzdHIubGVuZ3RoKSB7XG4gICAgICBsZXQgbGluZSA9IGRpZmZzdHJbaV07XG5cbiAgICAgIGlmICgvXihJbmRleDp8ZGlmZnxcXC1cXC1cXC18XFwrXFwrXFwrKVxccy8udGVzdChsaW5lKSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH0gZWxzZSBpZiAoL15AQC8udGVzdChsaW5lKSkge1xuICAgICAgICBpbmRleC5odW5rcy5wdXNoKHBhcnNlSHVuaygpKTtcbiAgICAgIH0gZWxzZSBpZiAobGluZSAmJiBvcHRpb25zLnN0cmljdCkge1xuICAgICAgICAvLyBJZ25vcmUgdW5leHBlY3RlZCBjb250ZW50IHVubGVzcyBpbiBzdHJpY3QgbW9kZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbGluZSAnICsgKGkgKyAxKSArICcgJyArIEpTT04uc3RyaW5naWZ5KGxpbmUpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGkrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBQYXJzZXMgdGhlIC0tLSBhbmQgKysrIGhlYWRlcnMsIGlmIG5vbmUgYXJlIGZvdW5kLCBubyBsaW5lc1xuICAvLyBhcmUgY29uc3VtZWQuXG4gIGZ1bmN0aW9uIHBhcnNlRmlsZUhlYWRlcihpbmRleCkge1xuICAgIGNvbnN0IGhlYWRlclBhdHRlcm4gPSAvXigtLS18XFwrXFwrXFwrKVxccysoW1xcUyBdKikoPzpcXHQoLio/KVxccyopPyQvO1xuICAgIGNvbnN0IGZpbGVIZWFkZXIgPSBoZWFkZXJQYXR0ZXJuLmV4ZWMoZGlmZnN0cltpXSk7XG4gICAgaWYgKGZpbGVIZWFkZXIpIHtcbiAgICAgIGxldCBrZXlQcmVmaXggPSBmaWxlSGVhZGVyWzFdID09PSAnLS0tJyA/ICdvbGQnIDogJ25ldyc7XG4gICAgICBpbmRleFtrZXlQcmVmaXggKyAnRmlsZU5hbWUnXSA9IGZpbGVIZWFkZXJbMl07XG4gICAgICBpbmRleFtrZXlQcmVmaXggKyAnSGVhZGVyJ10gPSBmaWxlSGVhZGVyWzNdO1xuXG4gICAgICBpKys7XG4gICAgfVxuICB9XG5cbiAgLy8gUGFyc2VzIGEgaHVua1xuICAvLyBUaGlzIGFzc3VtZXMgdGhhdCB3ZSBhcmUgYXQgdGhlIHN0YXJ0IG9mIGEgaHVuay5cbiAgZnVuY3Rpb24gcGFyc2VIdW5rKCkge1xuICAgIGxldCBjaHVua0hlYWRlckluZGV4ID0gaSxcbiAgICAgICAgY2h1bmtIZWFkZXJMaW5lID0gZGlmZnN0cltpKytdLFxuICAgICAgICBjaHVua0hlYWRlciA9IGNodW5rSGVhZGVyTGluZS5zcGxpdCgvQEAgLShcXGQrKSg/OiwoXFxkKykpPyBcXCsoXFxkKykoPzosKFxcZCspKT8gQEAvKTtcblxuICAgIGxldCBodW5rID0ge1xuICAgICAgb2xkU3RhcnQ6ICtjaHVua0hlYWRlclsxXSxcbiAgICAgIG9sZExpbmVzOiArY2h1bmtIZWFkZXJbMl0gfHwgMSxcbiAgICAgIG5ld1N0YXJ0OiArY2h1bmtIZWFkZXJbM10sXG4gICAgICBuZXdMaW5lczogK2NodW5rSGVhZGVyWzRdIHx8IDEsXG4gICAgICBsaW5lczogW11cbiAgICB9O1xuXG4gICAgbGV0IGFkZENvdW50ID0gMCxcbiAgICAgICAgcmVtb3ZlQ291bnQgPSAwO1xuICAgIGZvciAoOyBpIDwgZGlmZnN0ci5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IG9wZXJhdGlvbiA9IGRpZmZzdHJbaV1bMF07XG5cbiAgICAgIGlmIChvcGVyYXRpb24gPT09ICcrJyB8fCBvcGVyYXRpb24gPT09ICctJyB8fCBvcGVyYXRpb24gPT09ICcgJyB8fCBvcGVyYXRpb24gPT09ICdcXFxcJykge1xuICAgICAgICBodW5rLmxpbmVzLnB1c2goZGlmZnN0cltpXSk7XG5cbiAgICAgICAgaWYgKG9wZXJhdGlvbiA9PT0gJysnKSB7XG4gICAgICAgICAgYWRkQ291bnQrKztcbiAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRpb24gPT09ICctJykge1xuICAgICAgICAgIHJlbW92ZUNvdW50Kys7XG4gICAgICAgIH0gZWxzZSBpZiAob3BlcmF0aW9uID09PSAnICcpIHtcbiAgICAgICAgICBhZGRDb3VudCsrO1xuICAgICAgICAgIHJlbW92ZUNvdW50Kys7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEhhbmRsZSB0aGUgZW1wdHkgYmxvY2sgY291bnQgY2FzZVxuICAgIGlmICghYWRkQ291bnQgJiYgaHVuay5uZXdMaW5lcyA9PT0gMSkge1xuICAgICAgaHVuay5uZXdMaW5lcyA9IDA7XG4gICAgfVxuICAgIGlmICghcmVtb3ZlQ291bnQgJiYgaHVuay5vbGRMaW5lcyA9PT0gMSkge1xuICAgICAgaHVuay5vbGRMaW5lcyA9IDA7XG4gICAgfVxuXG4gICAgLy8gUGVyZm9ybSBvcHRpb25hbCBzYW5pdHkgY2hlY2tpbmdcbiAgICBpZiAob3B0aW9ucy5zdHJpY3QpIHtcbiAgICAgIGlmIChhZGRDb3VudCAhPT0gaHVuay5uZXdMaW5lcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FkZGVkIGxpbmUgY291bnQgZGlkIG5vdCBtYXRjaCBmb3IgaHVuayBhdCBsaW5lICcgKyAoY2h1bmtIZWFkZXJJbmRleCArIDEpKTtcbiAgICAgIH1cbiAgICAgIGlmIChyZW1vdmVDb3VudCAhPT0gaHVuay5vbGRMaW5lcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlbW92ZWQgbGluZSBjb3VudCBkaWQgbm90IG1hdGNoIGZvciBodW5rIGF0IGxpbmUgJyArIChjaHVua0hlYWRlckluZGV4ICsgMSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBodW5rO1xuICB9XG5cbiAgd2hpbGUgKGkgPCBkaWZmc3RyLmxlbmd0aCkge1xuICAgIHBhcnNlSW5kZXgoKTtcbiAgfVxuXG4gIHJldHVybiBsaXN0O1xufVxuIiwiLy8gSXRlcmF0b3IgdGhhdCB0cmF2ZXJzZXMgaW4gdGhlIHJhbmdlIG9mIFttaW4sIG1heF0sIHN0ZXBwaW5nXG4vLyBieSBkaXN0YW5jZSBmcm9tIGEgZ2l2ZW4gc3RhcnQgcG9zaXRpb24uIEkuZS4gZm9yIFswLCA0XSwgd2l0aFxuLy8gc3RhcnQgb2YgMiwgdGhpcyB3aWxsIGl0ZXJhdGUgMiwgMywgMSwgNCwgMC5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKHN0YXJ0LCBtaW5MaW5lLCBtYXhMaW5lKSB7XG4gIGxldCB3YW50Rm9yd2FyZCA9IHRydWUsXG4gICAgICBiYWNrd2FyZEV4aGF1c3RlZCA9IGZhbHNlLFxuICAgICAgZm9yd2FyZEV4aGF1c3RlZCA9IGZhbHNlLFxuICAgICAgbG9jYWxPZmZzZXQgPSAxO1xuXG4gIHJldHVybiBmdW5jdGlvbiBpdGVyYXRvcigpIHtcbiAgICBpZiAod2FudEZvcndhcmQgJiYgIWZvcndhcmRFeGhhdXN0ZWQpIHtcbiAgICAgIGlmIChiYWNrd2FyZEV4aGF1c3RlZCkge1xuICAgICAgICBsb2NhbE9mZnNldCsrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgd2FudEZvcndhcmQgPSBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgaWYgdHJ5aW5nIHRvIGZpdCBiZXlvbmQgdGV4dCBsZW5ndGgsIGFuZCBpZiBub3QsIGNoZWNrIGl0IGZpdHNcbiAgICAgIC8vIGFmdGVyIG9mZnNldCBsb2NhdGlvbiAob3IgZGVzaXJlZCBsb2NhdGlvbiBvbiBmaXJzdCBpdGVyYXRpb24pXG4gICAgICBpZiAoc3RhcnQgKyBsb2NhbE9mZnNldCA8PSBtYXhMaW5lKSB7XG4gICAgICAgIHJldHVybiBsb2NhbE9mZnNldDtcbiAgICAgIH1cblxuICAgICAgZm9yd2FyZEV4aGF1c3RlZCA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKCFiYWNrd2FyZEV4aGF1c3RlZCkge1xuICAgICAgaWYgKCFmb3J3YXJkRXhoYXVzdGVkKSB7XG4gICAgICAgIHdhbnRGb3J3YXJkID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgaWYgdHJ5aW5nIHRvIGZpdCBiZWZvcmUgdGV4dCBiZWdpbm5pbmcsIGFuZCBpZiBub3QsIGNoZWNrIGl0IGZpdHNcbiAgICAgIC8vIGJlZm9yZSBvZmZzZXQgbG9jYXRpb25cbiAgICAgIGlmIChtaW5MaW5lIDw9IHN0YXJ0IC0gbG9jYWxPZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIC1sb2NhbE9mZnNldCsrO1xuICAgICAgfVxuXG4gICAgICBiYWNrd2FyZEV4aGF1c3RlZCA9IHRydWU7XG4gICAgICByZXR1cm4gaXRlcmF0b3IoKTtcbiAgICB9XG5cbiAgICAvLyBXZSB0cmllZCB0byBmaXQgaHVuayBiZWZvcmUgdGV4dCBiZWdpbm5pbmcgYW5kIGJleW9uZCB0ZXh0IGxlbmdodCwgdGhlblxuICAgIC8vIGh1bmsgY2FuJ3QgZml0IG9uIHRoZSB0ZXh0LiBSZXR1cm4gdW5kZWZpbmVkXG4gIH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVPcHRpb25zKG9wdGlvbnMsIGRlZmF1bHRzKSB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGRlZmF1bHRzLmNhbGxiYWNrID0gb3B0aW9ucztcbiAgfSBlbHNlIGlmIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgbmFtZSBpbiBvcHRpb25zKSB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgICAgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgZGVmYXVsdHNbbmFtZV0gPSBvcHRpb25zW25hbWVdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gZGVmYXVsdHM7XG59XG4iXX0=
