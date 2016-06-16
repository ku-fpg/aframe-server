{-# LANGUAGE  RankNTypes, FlexibleInstances, UndecidableInstances, OverloadedStrings #-}

module Main where

import Data.Text (Text)
import Text.AFrame
import Text.AFrame.DSL 
import Web.AFrame.GHCi
import Web.AFrame
import Lens.Micro

example :: AFrame
example = scene $ do
  c <- colorSelector "color" "#123456"
  h <- numberSelector "height" 1 (0,5)
  r <- numberSelector "rot" 0 (0,360)
  xyz <- vec3Selector "position" (-1,0.5,1) (-5,5)
  mt <- numberSelector "metalness" 0.0 (0,1)
  op <- numberSelector "opacity"   1.0 (0,1)
  ro <- numberSelector "roughness" 0.5 (0,1)
  sphere $ do
    position (0,1.25,-1)
    radius   1.25
    color    "#EF2D5E"
    metalness mt
    opacity	op
    roughness ro
  box $ do
    attribute "id" ("box" :: Text)
    position xyz 
    rotation (r,45,0)
    width    1
    height   h
    scale    (1,1,1)
    color    c
  cylinder $ do
    position (1,0.75+sin(now / 1000),1) 
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