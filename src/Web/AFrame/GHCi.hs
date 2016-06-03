{-# LANGUAGE KindSignatures, GADTs, LambdaCase, ScopedTypeVariables, TypeOperators #-}
{-# LANGUAGE OverloadedStrings #-}

module Web.AFrame.GHCi
  ( start
  , r, u, q, (?)
  , Options(..)
  , defaultOptions
  ) where

import           Control.Concurrent
import qualified Control.Natural as N
import           Control.Natural(type (:~>), nat)
import qualified Control.Object as O
import           Control.Object ((#))

import           Data.Functor.Identity
import           Data.Monoid
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
start o = do obj <- aframeStart defaultOptions $ scene $ return () 
             putMVar aframeScene obj


r :: AFrame -> IO ()
r = u . const . return 

u :: (AFrame -> Identity AFrame) -> IO ()
u f = do
  obj <- readMVar aframeScene
  atomically $ do 
    af <- obj # GetAFrame
    obj # SetAFrame (runIdentity $ f af)

q :: IO AFrame 
q = do
  obj <- readMVar aframeScene
  atomically $ do
    obj # GetAFrame

(?) :: IO a -> (a -> First b) -> IO (Maybe b)
m ? lens = m >>= return . getFirst . lens
