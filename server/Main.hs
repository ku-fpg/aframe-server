{-# LANGUAGE KindSignatures, GADTs, LambdaCase, DeriveDataTypeable, ScopedTypeVariables, TypeOperators #-}
{-# LANGUAGE OverloadedStrings #-}
{-# OPTIONS_GHC -fno-cse #-}

module Main where

import qualified Control.Natural as N
import           Control.Natural((:~>), nat)
import qualified Control.Object as O
import           Control.Object ((#))
import           Control.Concurrent
import           Control.Concurrent.STM
import           Control.Monad

import qualified Data.Map.Strict as Map
import qualified Data.Text as T
import           Data.String (fromString)

import Text.AFrame
import Web.AFrame
import System.Environment 
import System.Console.GetOpt


options :: [OptDescr (Options -> Options)]
options = 
  [ Option [] ["js"]
        (ReqArg (\ d opts -> opts { jsFiles = jsFiles opts ++ [d] }) "path-or-URL")
        "javascript to include"
  , Option [] ["component"]
        (ReqArg (\ d opts -> opts { sceneComponents = sceneComponents opts ++ [d] }) "component")
        "scene components (fog | keyboard-shortcuts | stats  | ...)"
  , Option [] ["pull"]
        (NoArg (\ opts -> opts { pushPull = Pull }))
        "pull DOM changes into original aframe.html file"
  ]

main :: IO ()
main = do
    argv <- getArgs
    case getOpt Permute options argv of
      (o,[n],[]) -> main1 (foldl (flip id) (defaultOptions n) o)
      (_,_,errs) -> ioError (userError (concat errs ++ usageInfo header options))
  where header = "Usage: aframe-server [OPTION...] aframe.html"

main1 :: Options -> IO ()
main1 opts = do
  x <- readFile (scenePath opts)
  case readAFrame x of
    Nothing -> error "can not read sample file"
    Just a -> do obj <- aframeStart opts a
                 fileReader (scenePath opts) (1000 * 1000) obj



