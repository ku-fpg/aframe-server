{-# LANGUAGE KindSignatures, GADTs, LambdaCase #-}
{-# LANGUAGE OverloadedStrings #-}

module Web.AFrame where

import qualified Control.Object as O
import           Control.Object ((#))

import           Text.AFrame
import qualified Web.Scotty.CRUD as W

--import Network.HTTP.Types
import Web.Scotty as S
import Network.Wai.Middleware.Static

data AFrameP :: * -> * where
  SetAFrame :: AFrame -> AFrameP ()
  GetAFrame ::           AFrameP AFrame

-- :: Object


-- This entry point generates a server that handles the AFrame.
-- It never terminates, but can be started in a seperate thread.

aframeServer :: Int -> O.Object AFrameP -> IO ()
aframeServer port aframe = do

  let crudObj :: O.Object W.CRUD
      crudObj = O.Object $ \ case 
          W.Create {} -> fail "Create not supported"
          W.Get    v  -> fail "Get not supported"
          W.Table  _  -> fail "!!!"
--              af <- aframe # GetAFrame
--              return ()
          W.Update w  -> fail "Update not supported"
          W.Delete {} -> fail "Delete not supported"


  S.scotty port $ do
    S.middleware $ staticPolicy noDots
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
