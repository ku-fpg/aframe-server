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
     color: { default: '#FFF', type: 'string' },
     name: { default: 'color', type: 'string' }
   },
   init: function () {
     console.log('color-selector',datGUI);
     var g = findParentGUI(this.el);
     var el = this.el;
     g.addColor(this.data, 'color').name(this.data.name).onChange(function(value) {
       el.setAttribute('color-selector','color',value);
     });
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
       el.setAttribute('number-selector','number',value);
     });

     var that = this;
     ['min','max','step'].forEach(function(o) {
       if (that.data[o] != null) {
         s = s[o](that.data[o]);
       }
     });
   }
});


