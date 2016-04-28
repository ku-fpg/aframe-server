{-# LANGUAGE KindSignatures, GADTs, LambdaCase #-}
module Web.AFrame where

import qualified Control.Object as O
import           Control.Object ((#))

import           Text.AFrame
import qualified Web.Scotty.CRUD as W

data AFrameP :: * -> * where
  SetAFrame :: AFrame -> AFrameP ()
  GetAFrame ::           AFrameP AFrame



-- :: Object


-- This entry point generates a server that handles the AFrame.
-- It never terminates, but can be started in a seperate thread.

aframeServer :: Int -> IO ()
aframeServer port = do
  
  let aframeObj :: O.Object W.CRUD
      aframeObj = O.Object $ \ case 
          W.Create {} -> fail "Create not supported"
          W.Get    v  -> fail "Get not supported"
          W.Table  _  -> fail "Table not supported"
          W.Update w  -> fail "Update not supported"
          W.Delete {} -> fail "Delete not supported"
  
  return ()
