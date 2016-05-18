{-# LANGUAGE KindSignatures, GADTs, LambdaCase #-}
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

data AFrameP :: * -> * where
  SetAFrame       :: AFrame          -> AFrameP ()
  GetAFrame       ::                    AFrameP AFrame  -- ^ Get the current and/or latest aframe
  GetAFrameChange :: Property -> Int -> AFrameP Change  -- timeout time in ms (1/1000 seconds)

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

aframeServer :: String -> Int -> O.Object AFrameP -> IO ()
aframeServer scene port aframe = do
  let dir  = takeDirectory scene
      file = takeFileName scene

  let xRequest = do
        S.addHeader "Access-Control-Allow-Headers" "Authorization, Origin, X-Requested-With, Content-Type, Accep"
        S.addHeader "Access-Control-Allow-Methods" "POST, GET, PUT, DELETE, OPTIONS"
        S.addHeader "Access-Control-Allow-Origin"  "*"
        S.addHeader "Cache-Control" "no-cache, no-store, must-revalidate"

      aframeToText :: AFrame -> LT.Text
      aframeToText = LT.pack . showAFrame

  S.scotty port $ do
    S.middleware $ logStdoutDev

{-
    S.get (capture scene) $ do
          xRequest
          s <- liftIO $ do
                  aframe # GetAFrame
          S.html $ aframeToText $ s

    S.get (capture (scene <> "/:version")) $ do
          xRequest
          v <- param "version"
          s <- liftIO $ do
                  aframe # GetAFrameChange (Property v) 3000
          S.json $ s

-}
    S.get "/" $ do
      -- get the scene html file
      -- TODO: check to see if there is no HTML wrapper,
      -- and if not, use a (static) wrapper.
      txt <- liftIO $ do
            wrapper <- readFile scene
            af      <- aframe # GetAFrame
            return $ injectAFrame af wrapper
      S.html $ LT.pack $ txt   

    S.middleware $ staticPolicy (addBase dir)

--      S.file "./static/index.html"

{-
    S.get "/js/:file" $ do
          v <- param "file"      
          S.file ("./static/js/" <> v)

-}
{-
    S.get "/assets/:asset" $ do
      error "add asset support"
-}
{-
      v <- param "asset"
      case v of
        () | ".jpg" `isSuffixOf` 
      S.file "./static/index.html"
-}

  return ()
