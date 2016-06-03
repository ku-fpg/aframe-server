{-# LANGUAGE  RankNTypes, FlexibleInstances, UndecidableInstances #-}

module Main where

import Data.Text (Text)
import Text.AFrame
import Text.AFrame.DSL 
import Web.AFrame.GHCi
import Control.Lens

example :: AFrame
example = scene $ do
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
--  entity $ template $ src "#x"
