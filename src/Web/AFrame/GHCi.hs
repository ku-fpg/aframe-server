{-# LANGUAGE KindSignatures, GADTs, LambdaCase, ScopedTypeVariables, TypeOperators #-}
{-# LANGUAGE OverloadedStrings #-}

module Web.AFrame.GHCi
  ( start
  , set
  , Options(..)
  , defaultOptions
  , PushPull(..)
  ) where

import           Control.Concurrent
import qualified Control.Natural as N
import           Control.Natural(type (:~>), nat)
import qualified Control.Object as O
import           Control.Object ((#))

import           Data.String (fromString)

import           Text.AFrame as AFrame
import           Text.AFrame.DSL (scene)
import           Web.AFrame
import           Control.Concurrent.MVar
import           Control.Concurrent.STM

import           System.IO.Unsafe

{-# NOINLINE aframeScene #-}
aframeScene :: MVar (AFrameP :~> STM)
aframeScene = unsafePerformIO newEmptyMVar

start :: Options -> IO ()
start o = do obj <- aframeStart (defaultOptions "examples/demo.html") $ scene $ return () 
             putMVar aframeScene obj

set :: AFrame -> IO ()
set af = do
  obj <- readMVar aframeScene
  atomically (obj # SetAFrame af)
