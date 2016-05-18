{-# LANGUAGE KindSignatures, GADTs, LambdaCase, DeriveDataTypeable, ScopedTypeVariables #-}
{-# LANGUAGE OverloadedStrings #-}
{-# OPTIONS_GHC -fno-cse #-}

module Main where

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

data Options = Options 
  { -- jsFiles :: [String]
    scenePath :: FilePath
  , jsFiles   :: [String]
  , updateScene :: Bool
  } deriving (Show)

defaultOptions :: FilePath -> Options
defaultOptions f = Options
  { scenePath   = f
  , jsFiles     = []
  , updateScene = False
  }

options :: [OptDescr (Options -> Options)]
options = 
  [ Option [] ["js"]
        (ReqArg (\ d opts -> opts { jsFiles = jsFiles opts ++ [d] }) "path-or-URL")
        "javascript to include"
  ]

main :: IO ()
main = do
    argv <- getArgs
    case getOpt Permute options argv of
      (o,[n],[]) -> print (foldl (flip id) (defaultOptions n) o)
      (_,_,errs) -> ioError (userError (concat errs ++ usageInfo header options))
  where header = "Usage: aframe-server [OPTION...] aframe.html"

main1 :: Options -> IO ()
main1 opts = do
  x <- readFile (scenePath opts)
  case readAFrame x of
    Nothing -> error "can not read sample file"
    Just a -> main2 opts a

main2 :: Options -> AFrame -> IO ()
main2 opts a = do
  let fileName = scenePath opts

  let modifyDB new (fm,ix) =
       case Map.lookup ix fm of
        Nothing -> error "internal error"
        Just a | new == a  -> (fm,ix)   -- ignore
               | otherwise -> let ix' = succ ix
                              in (Map.insert ix' new fm,ix')

  var <- newTVarIO $ (Map.singleton 0 a, 0)

  print a
  putStrLn $ showAFrame a

  let obj = O.Object $ \ case
              GetAFrame -> atomically $ do
                                  (fm,ix) <- readTVar var
                                  case Map.lookup ix fm of
                                    Nothing -> error "internal error"
                                    Just v -> return $ setAttribute "version" (fromString $ show ix) $ v

              SetAFrame a -> atomically $ do
                                  (fm,ix) <- readTVar var
                                  -- version tag always overwritten on SetAFrame
                                  writeTVar var $ modifyDB a (fm,ix)

              GetAFrameChange (Property p) tm -> do
                            timer <- registerDelay (1000 * tm)
                            atomically $ do
                                  (fm,ix) <- readTVar var
                                  ping <- readTVar timer
                                  if T.pack (show ix) /= p 
                                  then return RELOAD
                                  else if ping 
                                       then return HEAD -- timeout
                                       else retry       -- try again


  forkIO $ fileReader fileName               (1000 * 1000) obj
  forkIO $ fileWriter (fileName ++ ".saved") (1000 * 1000) obj
  
  aframeServer fileName 3947 obj

fileReader :: String -> Int -> O.Object AFrameP -> IO ()
fileReader fileName delay obj = loop ""
  where
     loop old = do
        threadDelay delay
        new <- readFile fileName
        if new == old
        then loop new
        else case readAFrame new of
          Nothing -> loop old
          Just a -> do obj # SetAFrame a
                       loop new

fileWriter :: String -> Int -> O.Object AFrameP -> IO ()
fileWriter fileName delay obj = loop ""
  where
     loop old = do
        threadDelay delay
        aframe <- obj # GetAFrame
        case getAttribute "version" aframe of
          Just version | version == old -> loop version
                       | otherwise -> do
            -- we do not include the version number in what we save
            -- the version number is sessions 
            writeFile fileName $ showAFrame $ resetAttribute "version" $ aframe
            loop version
