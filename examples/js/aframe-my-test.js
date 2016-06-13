console.log("my-test");
var datGUI;

AFRAME.registerComponent('color-selector', {
   schema: {
     color: { default: '#FFF', type: 'string' },
     name: { default: 'color', type: 'string' }
   },
   init: function () {
     console.log('color-selector',datGUI);
     if (datGUI == undefined) {
        datGUI = new dat.GUI();       
     }
     console.log(this.el.parentEl.components)
     var g = datGUI;
     if (this.el.parentEl && 
       this.el.parentEl.components &&
       this.el.parentEl.components['selection-folder']) {
       g = this.el.parentEl.components['selection-folder'].data.folder
     }
     g.addColor(this.data, 'color').name(this.data.name)
   }
});

AFRAME.registerComponent('selection-folder', {
   schema: {
     name: { default: 'folder', type: 'string' },
     open: { default: true, type: 'boolean' }
   },
   init: function () {
     console.log('selection-folder',datGUI);
     if (datGUI == undefined) {
        datGUI = new dat.GUI();       
     }
     this.data.folder = datGUI.addFolder(this.data.name)
     if (this.data.open) {
       this.data.folder.open();
     }
   }
});
