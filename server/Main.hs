{-# LANGUAGE KindSignatures, GADTs, LambdaCase, DeriveDataTypeable, ScopedTypeVariables, TypeOperators #-}
{-# LANGUAGE OverloadedStrings #-}
{-# OPTIONS_GHC -fno-cse #-}

module Main where

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
  ]

main :: IO ()
main = do
    argv <- getArgs
    case getOpt Permute options argv of
      (o,[n],[]) -> main1 n (foldl (flip id) (defaultOptions { scenePath = Just n }) o)
      (_,_,errs) -> ioError (userError (concat errs ++ usageInfo header options))
  where header = "Usage: aframe-server [OPTION...] aframe.html"

main1 :: FilePath -> Options -> IO ()
main1 file opts = do
  x <- readFile file
  case readAFrame x of
    Nothing -> error "can not read sample file"
    Just a -> do obj <- aframeStart opts a
                 fileReader file (1000 * 1000) obj



