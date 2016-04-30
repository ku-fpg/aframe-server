{-# LANGUAGE KindSignatures, GADTs, LambdaCase #-}
{-# LANGUAGE OverloadedStrings #-}

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

main :: IO ()
main = do
  x <- readFile "example.aframe"
  case readAFrame x of
    Nothing -> error "can not read sample file"
    Just a -> main2 a


main2 :: AFrame -> IO ()
main2 a = do
  let modifyAFrame a (fm,ix) = (Map.insert ix' a' fm,ix')
        where ix' = succ ix
              a'  = setAttribute "version" (fromString $ show ix') a


  var <- newTVarIO $ modifyAFrame a $ (Map.empty,0)

  print a
  putStrLn $ showAFrame a

  let obj = O.Object $ \ case
              GetAFrame   -> atomically $ do
                                  (fm,ix) <- readTVar var
                                  case Map.lookup ix fm of
                                    Nothing -> error "internal error"
                                    Just v -> do
                                      return v

              SetAFrame a -> atomically $ do
                                  (fm,ix) <- readTVar var
                                  -- version tag always overwritten on SetAFrame
                                  writeTVar var $ modifyAFrame a (fm,ix)

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


  forkIO $ fileReader "example.aframe" (1000 * 1000) obj
  forkIO $ fileWriter "saved.aframe" (1000 * 1000) obj
  
  aframeServer "/scene" 3947 obj

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
