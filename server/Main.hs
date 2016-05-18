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
import System.Environment 

main :: IO ()
main = do
  [fileName] <- getArgs
  x <- readFile fileName
  case readAFrame x of
    Nothing -> error "can not read sample file"
    Just a -> main2 a fileName


main2 :: AFrame -> String -> IO ()
main2 a fileName = do
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
              GetAFrame   -> atomically $ do
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
