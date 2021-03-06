{-# LANGUAGE KindSignatures, GADTs, LambdaCase, ScopedTypeVariables, TypeOperators #-}
{-# LANGUAGE OverloadedStrings, RankNTypes, MultiParamTypeClasses #-}

module Web.AFrame.Object
  ( -- * constructor
    newObject
    -- * The Update data-structure
  , Object(..)
  , AFrameR(..)
  , Change(..)
    -- * Options
  , fileReader
  , fileWriter
  , aframeTrace
    -- * dummy AFrane
  , nonAFrame
  ) where

import           Control.Concurrent
import qualified Control.Natural as N
import           Control.Natural(type (:~>), type (~>), nat)
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

newtype Object = Object (AFrameR ~> STM)

instance N.Transformation AFrameR STM Object where
  Object f # g = f g

data AFrameR :: * -> * where
  SetAFrame       :: AFrame -> AFrameR ()
  GetAFrame       ::           AFrameR AFrame  --  Get the current and/or latest aframe
  GetAFrameStatus :: Int    -> AFrameR Change  --  version tag, returns instructions to get the the latest version

data Change = HEAD    -- ^ already at latest, signals a timeout
            | RELOAD  -- ^ change is complex; please reload entire model
            | DELTAS  -- ^ Small changes have been made; here they are
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

fileReader :: String -> Int -> Object -> IO ()
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

fileWriter :: String -> Int -> Object -> IO ()
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


aframeTrace :: Object -> IO ()
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


newObject :: AFrame -> IO Object
newObject a = do

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
  --

  var :: TVar (Map.Map Int AFrame, Int) <- newTVarIO $ (Map.singleton 0 a, 0)

  print a
  putStrLn $ showAFrame a

  return $ Object $ \ case
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


-- If you want to have an empty AFrame, and mark it as empty, just use an empty div.

nonAFrame :: AFrame
nonAFrame = AFrame "div" [] []
