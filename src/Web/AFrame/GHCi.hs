{-# LANGUAGE KindSignatures, GADTs, LambdaCase, ScopedTypeVariables, TypeOperators #-}
{-# LANGUAGE OverloadedStrings #-}

module Web.AFrame.GHCi
  ( start
  , s, u, g
  , Options(..)
  , defaultOptions
  ) where

import           Control.Concurrent
import qualified Control.Natural as N
import           Control.Natural(type (:~>), nat, (#))

import           Data.Functor.Identity
import           Data.Monoid
import           Data.String (fromString)

import           Text.AFrame as AFrame
import           Text.AFrame.DSL (scene)
import           Web.AFrame
import           Web.AFrame.Object
import           Control.Concurrent.MVar
import           Control.Concurrent.STM

import           System.IO.Unsafe

{-# NOINLINE aframeScene #-}
aframeScene :: MVar Object
aframeScene = unsafePerformIO newEmptyMVar

start :: Options -> IO ()
start o = do obj <- aframeStart defaultOptions $ scene $ return () 
             putMVar aframeScene obj


s :: AFrame -> IO ()
s = u . const  

u :: (AFrame -> AFrame) -> IO ()
u f = do
  obj <- readMVar aframeScene
  atomically $ do 
    af <- obj # GetAFrame
    obj # SetAFrame (f af)

g :: (AFrame -> a) -> IO a
g f = do
  obj <- readMVar aframeScene
  r <- atomically $ do
    obj # GetAFrame
  return $ f r
