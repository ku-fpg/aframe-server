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


data AFrameP :: * -> * where
  SetAFrame :: AFrame -> AFrameP ()
  GetAFrame ::           AFrameP AFrame

-- :: Object


-- This entry point generates a server that handles the AFrame.
-- It never terminates, but can be started in a seperate thread.

aframeServer :: String -> Int -> O.Object AFrameP -> IO ()
aframeServer scene port aframe = do


  let xRequest = do
        S.addHeader "Access-Control-Allow-Headers" "Authorization, Origin, X-Requested-With, Content-Type, Accep"
        S.addHeader "Access-Control-Allow-Methods" "POST, GET, PUT, DELETE, OPTIONS"
        S.addHeader "Access-Control-Allow-Origin"  "*"


      aframeToText :: AFrame -> LT.Text
      aframeToText = LT.pack . showAFrame
      

  S.scotty port $ do
    S.middleware $ staticPolicy noDots

    S.get (capture scene) $ do
          xRequest
          s <- liftIO $ do
                  aframe # GetAFrame
          S.html $ aframeToText $ s

    S.get "/" $ S.file "./static/index.html"
    S.get "/assets/:asset" $ do
      error "add asset support"
{-
      v <- param "asset"
      case v of
        () | ".jpg" `isSuffixOf` 
      S.file "./static/index.html"
-}

  return ()
