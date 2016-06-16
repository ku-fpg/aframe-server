{-# LANGUAGE  RankNTypes, FlexibleInstances, UndecidableInstances #-}

module Main where

import Data.Text (Text)
import Text.AFrame
import Text.AFrame.DSL 
import Web.AFrame.GHCi
import Web.AFrame
import Lens.Micro

example :: AFrame
example = scene $ do
  c <- colorSelector "color" "red"
  sphere $ do
    position (0,1.25,-1)
    radius   1.25
    color    "#EF2D5E"
    animation $ do
        attribute "id" ("animation-1" :: Text)
        fromTo position
              (0,1.25,-1)
              (0,1.00,-1)
        direction "alternate"
        easing "linear"
        dur 1000
        repeat_ "indefinite"
  box $ do
    attribute "id" ("box" :: Text)
    position (-1,0.5,1)
    rotation (0,45,0)
    width    1
    height   1
    scale    (1,1,1)
    color    c
  cylinder $ do
    position (1,0.75,1) 
    radius   0.5
    height   1.5
    color    "#FFC65D"
  plane $ do
    rotation (-90,0,0)
    width 4
    height 4
    color "#7BC8A4"
  sky $ color "#ECECEC"
--  entity $ template $ src "#x"

{-
 >>> start
 >>> s example
 >>> u (elementById "animation-1"  . attributeByName "dur) "300"
 >>> g (^. singular (elementById "animation-1"  . attributeByName "dur"))
 >>> u (set (nthOfType "a-box" 1 . attributeByName "position" . triple . _3) (-5))
-}

main = aframeStart opts $ example
 where opts = defaultOptions 
         { jsFiles = 
              [ "/examples/js/aframe-frp.js"
              ,"https://cdnjs.cloudflare.com/ajax/libs/dat-gui/0.5.1/dat.gui.min.js"
              ] 
         }