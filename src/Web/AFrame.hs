{-# LANGUAGE KindSignatures, GADTs #-}
module Web.AFrame where

import Text.AFrame

data AFrameP :: * -> * where
  SetAFrame :: AFrame -> AFrameP ()
  GetAFrame ::           AFrameP AFrame



-- :: Object


-- This entry point generates a server that handles the AFrame.
-- It never terminates, but can be started in a seperate thread.

aframeServer :: Int -> IO ()
aframeServer port = do
  
--  let aframeO = 
  
  return ()