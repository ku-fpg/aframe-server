{-# LANGUAGE KindSignatures, GADTs, LambdaCase #-}
{-# LANGUAGE OverloadedStrings #-}

module Main where

import qualified Control.Object as O
import           Control.Object ((#))

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
  print a
  putStrLn $ showAFrame a
  aframeServer "/scene" 3947 $ O.Object $ \ case
    GetAFrame   -> return $ a
    SetAFrame _ -> return ()

