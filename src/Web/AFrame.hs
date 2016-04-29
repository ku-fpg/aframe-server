{-# LANGUAGE KindSignatures, GADTs, LambdaCase #-}
{-# LANGUAGE OverloadedStrings #-}

module Web.AFrame where

import qualified Control.Object as O
import           Control.Object ((#))

import           Text.AFrame as AFrame
import qualified Web.Scotty.CRUD as W

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

  let crudObj :: O.Object W.CRUD
      crudObj = O.Object $ \ case 
          W.Create {} -> fail "Create not supported"
          W.Get    v  -> fail "Get not supported"
          W.Table  _  -> fail "!!!"
--              af <- aframe # GetAFrame
--              return ()
          W.Update w  -> fail "Update not supported"
          W.Delete {} -> fail "Delete not supported"


  let xRequest = do
        S.addHeader "Access-Control-Allow-Headers" "Authorization, Origin, X-Requested-With, Content-Type, Accep"
        S.addHeader "Access-Control-Allow-Methods" "POST, GET, PUT, DELETE, OPTIONS"
        S.addHeader "Access-Control-Allow-Origin"  "*"


--      ppAFrame :: AFrame -> Text
--      ppAFrame 

      xml :: String -> ActionM ()
      xml t = do
         S.setHeader "Content-Type" "text/html; charset=utf-8"
         raw $ UTF8.fromString $ t

      aframeToText :: AFrame -> LT.Text
      aframeToText = LT.pack . showAFrame
      
      ppConfig :: XML.ConfigPP
      ppConfig = defaultConfigPP 



  S.scotty port $ do
    S.middleware $ staticPolicy noDots


    S.get (capture scene) $ do
          xRequest
          s <- liftIO $ do
                  aframe # GetAFrame
          S.html $ aframeToText $ s




--    S.middleware logStdoutDev

    W.scottyCRUD "/scene" crudObj

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
