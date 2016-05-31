{-# LANGUAGE GADTs, OverloadedStrings #-}
-- | Small monadic DSL for AFrame generation.
module Text.AFrame.DSL where

import Data.Generic.Diff -- for testing
 
import Control.Monad
import Data.Text(Text,unpack)
import Text.AFrame


scene :: DSL () -> AFrame
scene m = case run prog 0 of
             ([], [f], _) -> f
             (_,  [],  _) -> error "scene internal error: no top-level primitive"
             (_,  [_], _) -> error "scene internal error: top-level attribute"
             (_,  _,   _) -> error "scene internal error: to many top-level primitives"
  where prog = prim "scene" m
        run :: DSL () -> Int -> ([Attribute],[AFrame],Int)
        run (Pure a) i = ([],[],i)
        run (Bind (Node nm m0) m) i0 = (attrs,AFrame (Primitive nm) attrs0 frames0:frames,i2)
          where (attrs0,frames0,i1) = run m0 i0
                (attrs,frames,i2)   = run m i1
        run (Bind (Attr a p) m) i0 = ((a,p):attrs,frames,i1)
          where (attrs,frames,i1) = run m i0

data DSL a where
  Pure :: a               -> DSL a
  Bind :: Item -> DSL a   -> DSL a
  Alloc :: (Int -> DSL a) -> DSL a

data Item where
  Node :: Text -> DSL () -> Item
  Attr :: Label -> Property -> Item

instance Functor DSL where
  fmap f g = pure f <*> g

instance Applicative DSL where
  pure = Pure
  (<*>) = ap

instance Monad DSL where
  return = pure
  (Pure a)    >>= k  = k a
  (Bind m k1) >>= k2 = Bind m (k1 >>= k2)
  (Alloc k)   >>= k2 = Alloc (\ i -> k i >>= k2)

prim :: Text -> DSL () -> DSL ()
prim nm m = Bind (Node nm m) (Pure ())

attr :: Label -> Property -> DSL ()
attr a p = Bind (Attr a p) (Pure ())

example :: AFrame 
example = scene $ do
  attr "Hello" "World"
  prim "foo" $ do
    attr "This" "That"


example2 :: AFrame 
example2 = scene $ do
  attr "Hello" "World"
  prim "foo" $ do
    return ()
    attr "This" "That!"
    
    

