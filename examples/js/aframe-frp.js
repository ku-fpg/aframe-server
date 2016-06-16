(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var datGUI;

function findParentGUI(el) {
  // If the immeduate parent is a folder, use the folder.
  if (el.parentEl && 
    el.parentEl.components &&
    el.parentEl.components['selection-folder']) {
    return el.parentEl.components['selection-folder'].folder
  } else {
    if (datGUI == undefined) {
       datGUI = new dat.GUI();       
    }
    return datGUI;
  }
}

AFRAME.registerComponent('selection-folder', {
   schema: {
     name: { default: 'folder', type: 'string' },
     open: { default: true, type: 'boolean' }
   },
   init: function () {
     var g = findParentGUI(this.el);
     var name = this.data.name;
     var count = 2;
     while(g.__folders[name] !== undefined) {
         name = this.data.name + " (" + count++ + ")"
     }

     this.folder = g.addFolder(name);

     if (this.data.open) {
       this.folder.open();
     }
   }
});

AFRAME.registerPrimitive('a-selection-folder',{
  mappings: {
    name:  'selection-folder.name',
    value: 'selection-folder.value'
  }
});

AFRAME.registerComponent('color-selector', {
   schema: {
     value: { default: '#FFF', type: 'string' },
     name: { default: 'color', type: 'string' }
   },
   init: function () {
     var g = findParentGUI(this.el);
     var el = this.el;
     function change(value) {
       if (el.tagName == "A-COLOR-SELECTOR") { 
         el.setAttribute('value',value);
       } else {
         el.setAttribute('color-selector','value',value);
       }
     }
     g.addColor(this.data, 'value').name(this.data.name).onChange(change);
   }
});

AFRAME.registerPrimitive('a-color-selector',{
  mappings: {
    name:  'color-selector.name',
    value: 'color-selector.value'
  }
});

AFRAME.registerComponent('number-selector', {
   schema: {
     value: { default: '0', type: 'number' },
     name: { default: 'number', type: 'string' },
     min: { default: null, type: 'number' },
     max: { default: null, type: 'number' },
     step: { default: null, type: 'number' }
   },
   init: function () {
//     console.log('number-selector',datGUI);
//     console.log(this.data)
     if (datGUI == undefined) {
        datGUI = new dat.GUI();       
     }
     var g = findParentGUI(this.el);
     var el = this.el;

     var change = function(value) {
       if (el.tagName == "A-NUMBER-SELECTOR") { 
         el.setAttribute('value',value);
         el.setAttribute('type','number');
       } else {
         el.setAttribute('number-selector','value',value);
       }
     };
     change(this.data.value)
     var s = g.add(this.data, 'value').name(this.data.name).onChange(change);

     var that = this;
     ['min','max','step'].forEach(function(o) {
       if (that.data[o] != null) {
         s = s[o](that.data[o]);
       }
     });
   }
});

AFRAME.registerPrimitive('a-number-selector',{
  mappings: {
    value: 'number-selector.value',
    name: 'number-selector.name',
    min: 'number-selector.min',
    max: 'number-selector.max',
    step: 'number-selector.step'
  }
});


AFRAME.registerComponent('behavior', {
  schema: { default: "", type: 'string' },
  init: function () {
     console.log('frp',this.data);
  },
  tick: function(o) {
    var self = this;
    var target  = this.el.parentEl;
    var oldAttr = target.getAttribute(this.data.attribute);
    var env =
     { vec3: function(x,y,z) { return {x:x,y:y,z:z}; },
       id: function(o) { 
         var el = document.getElementById(o);
         var value = el.getAttribute("value");
         var type  = el.getAttribute("type");
         if (type == 'number') {
           return parseInt(value);
         }
         return value;
      }
     };

    var self = this;

    Object.keys(this.el.attributes).forEach(function (ix) {
       var name = self.el.attributes[ix].name;
         if (env[name] == undefined && self.el.hasAttribute(name)) {
           env[name] = self.el.getAttribute(name);
         }
    });

    var copy = AFRAME.utils.extendDeep({},env);
    try { 
      with (env) { 
        eval(this.data); 
      }
    } 
    catch(ex) {
        console.log(ex);
    }

    Object.keys(this.el.attributes).forEach(function (ix) {
        var name = self.el.attributes[ix].name;
//        console.log(ix,env[ix],copy[ix])
        if (env[name] !== copy[name]) {
//          console.log("updating",name,env[name],copy[name])
          self.el.setAttribute(name,env[name])
        }
      });
  }
});


},{}]},{},[1]);
