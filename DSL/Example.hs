module Main where

import Text.AFrame
import Text.AFrame.DSL 

example :: AFrame
example = scene $ do
  sphere $ do
    position (0,1.25,-1)
    radius   1.25
    color    "#EF2D5E"
  box $ do
    position (0,1.25,-1)
    rotation (0,45,0)
    width    1
    height   1
    color    "#4CC3D9"
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
