{-# LANGUAGE KindSignatures, GADTs, LambdaCase, ScopedTypeVariables, TypeOperators #-}
{-# LANGUAGE OverloadedStrings #-}

module Web.AFrame 
  ( -- * The Update data-structure
    AFrameP(..)  
  , Change(..)
    -- * Options
  , Options(..)
  , defaultOptions
    -- * The web server
  , aframeStart
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


import Paths_aframe_server


data Options = Options 
  { scenePath       :: Maybe FilePath   -- The AFrame Text, embedded inside an HTML document. (or default static file)
  , jsFiles         :: [String]   -- JS files to inject into theh HTML
  , sceneComponents :: [String]   -- components to inject into the \<a-scene>
  } deriving (Show)
 
defaultOptions :: Options
defaultOptions = Options
  { scenePath       = Nothing
  , jsFiles         = []
  , sceneComponents = []
  } 


data AFrameP :: * -> * where
  SetAFrame       :: AFrame -> AFrameP ()
  GetAFrame       ::           AFrameP AFrame  --  Get the current and/or latest aframe
  GetAFrameStatus :: Int    -> AFrameP Change  --  version tag, returns instructions to get the the latest version

data Change = HEAD    -- already at latest, signals a timeout
            | RELOAD  -- change is complex; please reload entire model
            | DELTAS  -- Small changes have been made; here they are
                      -- Always include an update to the verison tag.
                [(Path,Attribute)]

instance ToJSON Change where
    -- this generates a Value
    toJSON HEAD   = object ["change" .= ("HEAD" :: String)]
    toJSON RELOAD = object ["change" .= ("RELOAD" :: String)]
    toJSON (DELTAS pas) 
                  = object ["change" .= ("DELTAS" :: String)
                           ,"changes" .= 
                               [ object ["path" .= p, "attr" .= l, "value" .= v]
                               | (p,(l,v)) <-  pas
                               ]
                           ]
        


-- | create a web server, and our AFrameP object, returning the AFrameP object.
aframeStart :: Options -> AFrame -> IO (AFrameP :~> STM)
aframeStart opts a = do
  let fileName = scenePath opts

  let modifyDB new (fm,ix) =
       case Map.lookup ix fm of
        Nothing -> error "internal error"
        Just a | new == a  -> (fm,ix)   -- ignore
               | otherwise -> let ix' = succ ix
                              in (Map.insert ix' new fm,ix')

  -- The DB is a tuple of (map from # to AFrame, and the current #)
  -- GET gets the current # via lookup
  -- SET sets a *new/unique* #, if there are changes
  --   - It is not possible to SET a version without making a change first;
  --   - A dup update is the identity.
  -- The version tag is never in the underlying AFrame, but added
  -- when GET-ing the AFrame, and removed/ignored when SET-ing.
  -- The act of SET-ing is *asking* for a new version number to be assigned.
  var :: TVar (Map.Map Int AFrame, Int) <- newTVarIO $ (Map.singleton 0 a, 0)

  print a
  putStrLn $ showAFrame a

  let obj :: AFrameP :~> STM
      obj = nat $ \ case
              GetAFrame -> do
                                  (fm,ix) <- readTVar var
                                  case Map.lookup ix fm of
                                    Nothing -> error "internal error"
                                    Just v -> return $ setAttribute "version" (fromString $ show ix) $ v

              SetAFrame a -> do
                                  (fm,ix) <- readTVar var
                                  -- version tag always overwritten on SetAFrame
                                  writeTVar var $ modifyDB a (fm,ix)
              GetAFrameStatus p -> do
                                  (fm,ix) <- readTVar var
                                  if ix /= p 
                                  then case (Map.lookup p fm,Map.lookup ix fm) of
                                         (Just old,Just new) ->
                                            case deltaAFrame old new of
                                              Just diffs -> return 
                                                                $ DELTAS
                                                                $ (Path "a-scene" [],("version",fromString $ show ix))
                                                                : diffs
                                              Nothing -> return RELOAD
                                         _ -> return RELOAD
                                  else retry       -- try again

  forkIO $ aframeServer fileName 3947 (jsFiles opts) obj
  
  return obj

-- This entry point generates a server that handles the AFrame.
-- It never terminates, but can be started in a seperate thread.
-- The first argument is the name of the file to be server.
-- The second argument is the port to be served from.
-- The thrid argument is a list of URLs to serve up as 

aframeServer :: Maybe String -> Int -> [String] -> (AFrameP :~> STM) -> IO ()
aframeServer optScene port jssExtras aframe = do
  let dir  = case optScene of
               Just s -> takeDirectory s
               Nothing    -> "."
  scene <- case optScene of
               Just s  -> return s
               Nothing -> getDataFileName "static/index.html"
  let jquery = "https://code.jquery.com/jquery-2.2.3.min.js"
      utils  = "aframe-server-utils.js"
      scenes :: [(String,[String])]
      scenes = map (\ (a,b) -> (a,b ++ jssExtras))
               [ ("/",[])
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

    sequence_ 
      [ S.get (capture s) $ do
          -- get the scene html file
          -- TODO: check to see if there is no HTML wrapper,
          -- and if not, use a (static) wrapper.
          txt <- liftIO $ do
                wrapper <- readFile scene
                af      <- atomically (aframe # GetAFrame)
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
                  atomically (aframe # GetAFrame)
          S.html $ aframeToText $ s

    S.get ("/status/:version") $ do
          xRequest
          v :: Int <- param "version"
          s <- liftIO $ do
                  timer <- registerDelay (3 * 1000 * 1000)
                  atomically $
                        (aframe # GetAFrameStatus v) `orElse`
                                do ping <- readTVar timer
                                   if ping 
                                   then return HEAD -- timeout
                                   else retry       -- try again

          S.json $ s

    S.middleware $ staticPolicy (addBase dir)

  return ()

fileReader :: String -> Int -> (AFrameP :~> STM) -> IO ()
fileReader fileName delay obj = loop ""
  where
     loop old = do
        threadDelay delay
        new <- readFile fileName
        if new == old
        then loop new
        else case readAFrame new of
          Nothing -> loop old
          Just a -> do atomically (obj # SetAFrame a)
                       loop new

fileWriter :: String -> Int -> (AFrameP :~> STM) -> IO ()
fileWriter fileName delay obj = loop ""
  where
     loop old = do
        threadDelay delay
        aframe <- atomically (obj # GetAFrame)
        case getAttribute "version" aframe of
          Just version | version == old -> loop version
                       | otherwise -> do
            -- we do not include the version number in what we save
            -- the version number is sessions 
            writeFile fileName $ showAFrame $ resetAttribute "version" $ aframe
            loop version


aframeTrace :: (AFrameP :~> STM) -> IO ()
aframeTrace obj = do
        aframe <- atomically (obj # GetAFrame)
        loop aframe
  where
     loop old = do
        threadDelay (1000 * 1000)
        new <- atomically (obj # GetAFrame)
        if old == new
        then loop new
        else do
            let ds = deltaAFrame old new 
            print ("diff",ds) -- Diff.compress ds)
            loop new
