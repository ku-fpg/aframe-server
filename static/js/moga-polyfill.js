(function(){
    var f = navigator.getGamepads;
    navigator.getGamepads = function(){ 
        function GamepadButton(b) {
            this.pressed = b;
            this.value = b?1:0;
        }
        var trueButton = new GamepadButton(true);
        var falseButton = new GamepadButton(false);

        function Gamepad(o) {
            var that = this;
            this.axes = [0,1,2,5].map(function(v) {
              return o.axes[v]
    	    });
            this.buttons = 
    	    [0,1,3,4,6,7,null,null,null,11,
    	     13,14,null,null,null,null].map(function(v) {
    		     if (v == null) {
    			 return falseButton;
    		     } else {
                return o.buttons[v]
    		     }
    		 });
            if (o.axes[9] <= 1) {
    	    var dir = Math.round((1 + o.axes[9]) * 3.5);
    	    var updates = [[12],[12,15],[15],[15,13],[13],[13,14],[14],[14,12]]
    		updates[dir].map(function(i) {
    			console.log(that.buttons,i,trueButton)
    			that.buttons[i] = trueButton;
    		    })
    		}
            if (o.axes[3] < 1) {
    	    that.buttons[6] = trueButton;
            }
            if (o.axes[4] < 1) {
    	    that.buttons[7] = trueButton;
            }
            this.connected = true;
            this.id        = o.id;
            this.index     = o.index;
        }
        var r = f.call(navigator);
        function GamepadList(r) {
            this.length = 4;
            for(i = 0;i < this.length;i++) {
    	    if (r[i] != undefined) {
    		this[i] = new Gamepad(r[i]);
    	    } else {
    		this[i] = undefined;
    	    }
            }
        }
        return new GamepadList(r); 
    }
})();

