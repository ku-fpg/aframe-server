{-# LANGUAGE KindSignatures, GADTs, LambdaCase #-}
{-# LANGUAGE OverloadedStrings #-}

module Main where

import qualified Control.Object as O
import           Control.Object ((#))
import           Control.Concurrent
import           Control.Concurrent.STM
import           Control.Monad

import Text.AFrame
import Web.AFrame

main :: IO ()
main = do
  x <- readFile "example.aframe"
  case readAFrame x of
    Nothing -> error "can not read sample file"
    Just a -> main2 a
    
main2 :: AFrame -> IO ()
main2 a = do
  var <- newTVarIO a
  print a
  putStrLn $ showAFrame a

  let obj = O.Object $ \ case
              GetAFrame   -> atomically $ readTVar var
              SetAFrame a -> atomically $ writeTVar var a

  forkIO $ forever $ do
      threadDelay (1000 * 1000)
      x <- readFile "example.aframe"
      case readAFrame x of
        Nothing -> return ()
        Just a -> obj # SetAFrame a


  aframeServer "/scene" 3947 obj
