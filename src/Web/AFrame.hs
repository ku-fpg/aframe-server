{-# LANGUAGE KindSignatures, GADTs, LambdaCase, ScopedTypeVariables #-}
{-# LANGUAGE OverloadedStrings #-}

module Web.AFrame where

import qualified Control.Object as O
import           Control.Object ((#))

import           Text.AFrame as AFrame

--import Network.HTTP.Types
import Web.Scotty as S
import Network.Wai.Middleware.Static
import qualified Data.ByteString.Lazy as LBS
import qualified Data.ByteString.Lazy.UTF8 as UTF8
import           Control.Monad.IO.Class (liftIO)
import Text.XML.Light as XML
import qualified Data.Text.Lazy as LT
import qualified Data.Text as T
import           Data.Aeson (ToJSON(..), object, (.=))
import qualified Data.Aeson as A
import Data.Monoid ((<>))

import Network.Wai.Middleware.RequestLogger (logStdoutDev)
import System.FilePath.Posix as P
import Data.List as L

data AFrameP :: * -> * where
  SetAFrame       :: AFrame     -> AFrameP ()
  GetAFrame       ::               AFrameP AFrame  -- ^ Get the current and/or latest aframe
  GetAFrameStatus :: Int -> Int -> AFrameP Change  -- ^ version tag, and timeout time in ms

data Change = HEAD    -- already at latest, signals a timeout
            | RELOAD  -- change is complex; please reload entire model

instance ToJSON Change where
    -- this generates a Value
    toJSON HEAD   = object ["change" .= ("HEAD" :: String)]
    toJSON RELOAD = object ["change" .= ("RELOAD" :: String)]
        
-- This entry point generates a server that handles the AFrame.
-- It never terminates, but can be started in a seperate thread.
-- The first argument is the name of the file to be server.
-- The second argument is the port to be served from.
-- The thrid argument is a list of URLs to serve up as 

aframeServer :: String -> Int -> [String] -> O.Object AFrameP -> IO ()
aframeServer scene port jssExtras aframe = do
  let dir  = takeDirectory scene
      file = takeFileName scene
      jquery = "https://code.jquery.com/jquery-2.2.3.min.js"
      push   = "/static/js/aframe-push.js"
      scenes :: [(String,[String])]
      scenes = map (\ (a,b) -> (a,b ++ jssExtras))
               [ ("/",[])
               , ("/dynamic.html",
                    [ "https://code.jquery.com/jquery-2.2.3.min.js"
                    , "/static/js/aframe-push.js"
                    ])
               , ("/edit.html",
                    [ "https://code.jquery.com/jquery-2.2.3.min.js"
                    , "/static/js/aframe-pull.js"
                    ])
               ]

               --  use with aframe-pull (TODO)
               -- , "https://cdnjs.cloudflare.com/ajax/libs/dat-gui/0.5.1/dat.gui.min.js"

  let injectJS jss n cs | "</head>" `L.isPrefixOf` cs = 
        unlines [ s ++ "  <script src=\"" ++ js ++ "\"></script>"
                | (s,js) <- ("":repeat spaces) `zip` jss
                ] ++ spaces ++ cs
          where spaces = take n $ repeat ' '
      injectJS jss n (c:cs) = case c of
           ' ' -> c : injectJS jss (n+1) cs
           _   -> c : injectJS jss 0     cs
      injectJS jss n []     = []

      -- Not required, because we are in the same domain the whole time???
  let xRequest = do
        S.addHeader "Access-Control-Allow-Headers" "Authorization, Origin, X-Requested-With, Content-Type, Accep"
        S.addHeader "Access-Control-Allow-Methods" "POST, GET, PUT, DELETE, OPTIONS"
        S.addHeader "Access-Control-Allow-Origin"  "*"
        S.addHeader "Cache-Control" "no-cache, no-store, must-revalidate"

      aframeToText :: AFrame -> LT.Text
      aframeToText = LT.pack . showAFrame

  S.scotty port $ do
    S.middleware $ logStdoutDev

    sequence_ 
      [ S.get (capture s) $ do
          -- get the scene html file
          -- TODO: check to see if there is no HTML wrapper,
          -- and if not, use a (static) wrapper.
          txt <- liftIO $ do
                wrapper <- readFile scene
                af      <- aframe # GetAFrame
                return $ injectJS jss 0 $ injectAFrame af wrapper
          S.html $ LT.pack $ txt   
      | (s,jss) <- scenes
      ]

    -- support the static files
    sequence_ 
      [ S.get (capture p) $ do
          S.file $ fileLocation
      | p@('/':fileLocation) <- L.nub $ concat $ map snd scenes
      ]

    S.get ("/scene") $ do
          xRequest
          s <- liftIO $ do
                  aframe # GetAFrame
          S.html $ aframeToText $ s

    S.get ("/status/:version") $ do
          xRequest
          v :: Int <- param "version"
          s <- liftIO $ do
                  aframe # GetAFrameStatus v 3000
          S.json $ s

    S.middleware $ staticPolicy (addBase dir)

  return ()
