console.log("my-test");
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
     console.log('selection-folder',datGUI);
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

AFRAME.registerComponent('color-selector', {
   schema: {
     value: { default: '#FFF', type: 'string' },
     name: { default: 'color', type: 'string' }
   },
   init: function () {
     console.log('color-selector',datGUI);
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
     number: { default: '0', type: 'number' },
     name: { default: 'number', type: 'string' },
     min: { default: null, type: 'number' },
     max: { default: null, type: 'number' },
     step: { default: null, type: 'number' }
   },
   init: function () {
     console.log('number-selector',datGUI);
     console.log(this.data)
     if (datGUI == undefined) {
        datGUI = new dat.GUI();       
     }
     var g = findParentGUI(this.el);
     var el = this.el;

     var s = g.add(this.data, 'number').name(this.data.name).onChange(function(value) {
       if (el.tagName == "A-NUMBER-SELECTOR") { 
         el.setAttribute('number',value);
       } else {
         el.setAttribute('number-selector','number',value);
       }
     });

     var that = this;
     ['min','max','step'].forEach(function(o) {
       if (that.data[o] != null) {
         s = s[o](that.data[o]);
       }
     });
   }
});

AFRAME.registerPrimitive('a-number-selector',{
  defaultComponents: {
    "number-selector": { }
  },
  mappings: {
    number: 'number-selector.number',
    name: 'number-selector.name',
    min: 'number-selector.min',
    max: 'number-selector.max',
    step: 'number-selector.step'
  }
});


AFRAME.registerComponent('frp', {
  schema: {
    attribute: { default: null, type: 'string' },
    behavior:  { default: null, type: 'string' }
  },
   init: function () {
     console.log('frp',this.data);
   },
   tick: function(o) {
     var self = this;
     var target  = this.el.parentEl;
     var oldAttr = target.getAttribute(this.data.attribute);
     var env =
       { vec3: function(x,y,z) { return {x:x,y:y,z:z}; },
         "$": function(o) { 
            var el = document.getElementById(o);
            return 0;
        }
       };
     var res = undefined;
     try { 
       with (env) { res = eval(this.data.behavior); }
     } 
     catch(ex) {
       console.log(ex);
     }
//     console.log("frp",res);
     target.setAttribute("rotation",{x:o/10,y:0,z:0});
       if (this.done == undefined) {
       console.log("frp",this,target);
       this.done = true;
     }

//     console.log('frp-tick',o);
   }
 });

 AFRAME.registerPrimitive('a-frp',{
   mappings: {
     attribute: 'frp.attribute',
     behavior:  'frp.behavior'
   }
 });
