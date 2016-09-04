{-# LANGUAGE KindSignatures, GADTs, LambdaCase, ScopedTypeVariables, TypeOperators #-}
{-# LANGUAGE OverloadedStrings #-}

module Web.AFrame 
  ( -- * The Update data-structure
    AFrameR(..)  
  , Change(..)
    -- * Options
  , Options(..)
  , defaultOptions
  , ServerState(..)
    -- * The web server
  , aframeStart
--  , aframeServe
    -- * Actors for the AFrameP object
  , fileReader
  , fileWriter
  , aframeTrace
  ) where

import           Control.Concurrent
import qualified Control.Natural as N
import           Control.Natural(type (:~>), nat)
import qualified Control.Object as O
import           Control.Object ((#))

import           Data.String (fromString)

import           Text.AFrame as AFrame

--import Network.HTTP.Types
import Web.Scotty as S hiding (Options)
import Network.Wai.Middleware.Static
import qualified Data.ByteString.Lazy as LBS
import qualified Data.ByteString.Lazy.UTF8 as UTF8
import           Control.Monad.IO.Class (liftIO)
import qualified Data.Text.Lazy as LT
import qualified Data.Text as T
import           Data.Aeson (ToJSON(..), object, (.=))
import qualified Data.Aeson as A
import           Control.Concurrent.STM
import Data.Monoid ((<>))

import Network.Wai.Middleware.RequestLogger (logStdoutDev)
import System.FilePath.Posix as P
import Data.List as L

import qualified Data.Map.Strict as Map

import           Web.AFrame.Object

import Paths_aframe_server


data Options = Options 
  { scenePath       :: Maybe FilePath   -- The AFrame Text, embedded inside an HTML document. 
                                        -- Nothing when you have no original file.
                                        -- Currenly only used to find the root directory
  , jsFiles         :: [String]   -- JS files to inject into theh HTML
  , sceneComponents :: [String]   -- components to inject into the \<a-scene>
  } deriving (Show)
 
defaultOptions :: Options
defaultOptions = Options
  { scenePath       = Nothing
  , jsFiles         = []
  , sceneComponents = []
  } 

data ServerState = ServerState 
 { masterAFrame :: Object               -- this is the one we serve, RO
 , shadowAFrame :: Object               -- this is the shadow, which is a copy of the /edit page's DOM.
                                        -- it may be empty (how?)
 }

-- | create a web server, and our AFrameP object, returning the AFrameP object.
aframeStart :: Options -> AFrame -> IO ServerState
aframeStart opts a = do
  let fileName = scenePath opts

  master <- newObject a
  shadow <- newObject nonAFrame

  let state = ServerState master shadow

  forkIO $ aframeServer fileName 3947 (jsFiles opts) $ state
  
  return state

-- This entry point generates a server that handles the AFrame.
-- It never terminates, but can be started in a seperate thread.
-- The first argument is the name of the file to be server.
-- The second argument is the port to be served from.
-- The thrid argument is a list of URLs to serve up as 

aframeServer :: Maybe String -> Int -> [String] -> ServerState -> IO ()
aframeServer optScene port jssExtras state = do
  let dir  = case optScene of
               Just s -> takeDirectory s
               Nothing    -> "."
  scene <- case optScene of
               Just s  -> return s
               Nothing -> getDataFileName "static/default.html"
  let jquery = "https://code.jquery.com/jquery-2.2.3.min.js"
      utils  = "aframe-server-utils.js"
      scenes :: [(String,[String])]
      scenes = map (\ (a,b) -> (a,b ++ jssExtras))
               [ ("/static.html",[])
               , ("/dynamic.html",
                    [ "https://code.jquery.com/jquery-2.2.3.min.js"
                    ] ++
                    [ "/static/js/" ++ js | js <- [utils]
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
--    S.middleware $ logStdoutDev

    S.get "/" $ do
       txt <- liftIO $ getDataFileName $ "static/index.html"
       S.file $ txt

    sequence_ 
      [ S.get (capture s) $ do
          -- get the scene html file
          -- TODO: check to see if there is no HTML wrapper,
          -- and if not, use a (static) wrapper.
          txt <- liftIO $ do
                wrapper <- readFile scene
                af      <- atomically (masterAFrame state # GetAFrame)
                return $ injectJS jss 0 $ injectAFrame af wrapper
--                return $ wrapper
          S.html $ LT.pack $ txt   
      | (s,jss) <- scenes
      ]

    -- support the static files
    sequence_
      [ S.get (capture ("/static/js/" ++ js)) $ do
          f' <- liftIO $ getDataFileName $ "static/js/" ++ js
          S.file $ f'
      | js <- [utils]
      ]

    -- support the CLI files
    sequence_ 
      [ S.get (capture p) $ do
          S.file $ fileLocation
      | p@('/':fileLocation) <- L.nub $ concat $ map snd scenes
      , not $ "/static/" `L.isPrefixOf` p
      ]

    S.get ("/scene") $ do
          xRequest
          s <- liftIO $ do
                  atomically (masterAFrame state # GetAFrame)
          S.html $ aframeToText $ s

    S.get ("/status/:version") $ do
          xRequest
          v :: Int <- param "version"
          s <- liftIO $ do
                  timer <- registerDelay (3 * 1000 * 1000)
                  atomically $
                        (masterAFrame state # GetAFrameStatus v) `orElse`
                                do ping <- readTVar timer
                                   if ping 
                                   then return HEAD -- timeout
                                   else retry       -- try again

          S.json $ s

    S.middleware $ staticPolicy (addBase dir)

  return ()

{-
  -- | a version of 'aframeStart' that does not return.
aframeServe :: Options -> AFrame -> IO (AFrameP :~> STM)
aframeServe opt af = do
  o <- aframeStart opt af
  let loop = do
        threadDelay (1000 * 1000)
        loop
  loop
-}