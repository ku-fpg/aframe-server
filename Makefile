test::
# To have the inspector, load aframe-inspector and dat-gui
	./dist/build/aframe-server/aframe-server examples/demo.html \
		--js=https://cdnjs.cloudflare.com/ajax/libs/dat-gui/0.5.1/dat.gui.min.js \
		--js=/js/aframe-frp.js \
		--js=/js/aframe-my-test.js \
#		--js=/js/aframe-inspector.js \

build::
	npm run build
	cp ./static/js/aframe-server-utils.js ./.cabal-sandbox/share/x86_64-osx-ghc-7.10.3/aframe-server-0.1.0.0/static/js/aframe-server-utils.js
