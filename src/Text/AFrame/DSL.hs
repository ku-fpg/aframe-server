{-# LANGUAGE GADTs, OverloadedStrings, KindSignatures, DataKinds, FlexibleInstances, InstanceSigs #-}
-- | Small monadic DSL for AFrame generation.
module Text.AFrame.DSL where

import Control.Monad
import Data.Text(Text,unpack,pack)
import Text.AFrame
import Numeric

---------------------------------------------------------------------------------

class ToProperty c where
  toProperty :: c -> Property

class Component f where
  component :: ToProperty c => Label -> c -> f ()

class Component f => Entity f where
  entity :: Text -> f () -> f ()

---------------------------------------------------------------------------------
-- Properties DSL

data List x a where
  List :: [Attribute] -> a -> List x a
  
instance Functor (List x) where
  fmap f g = pure f <*> g

instance Applicative (List x) where
  pure = return
  (<*>) = ap

instance Monad (List x) where
  return = List []
  List ps a >>= k = case k a of
                      List ps' a' -> List (ps ++ ps') a'

instance ToProperty (List Attribute ()) where
  toProperty (List xs ()) = packProperty xs

instance Component (List c) where
  component lab c = List [(lab,toProperty c)] ()

---------------------------------------------------------------------------------
-- Entity DSL

data DSL (k :: E) a where
  Pure :: a                 -> DSL k a
  Bind :: Item -> DSL k a   -> DSL k a
  Alloc :: (Int -> DSL k a) -> DSL k a

instance Functor (DSL k) where
  fmap f g = pure f <*> g

instance Applicative (DSL k) where
  pure = Pure
  (<*>) = ap

instance Monad (DSL k) where
  return = pure
  (Pure a)    >>= k  = k a
  (Bind m k1) >>= k2 = Bind m (k1 >>= k2)
  (Alloc k)   >>= k2 = Alloc (\ i -> k i >>= k2)

instance Component (DSL 'E) where
  component :: ToProperty c => Label -> c -> DSL k ()
  component lab c = Bind (Attr lab (toProperty c)) (Pure ())

instance Component (DSL 'A) where
  component :: ToProperty c => Label -> c -> DSL k ()
  component lab c = Bind (Attr lab (toProperty c)) (Pure ())

instance Entity (DSL 'E) where
  entity :: Text -> DSL 'E () -> DSL 'E ()
  entity nm m = Bind (Node nm m) (Pure ())  

---------------------------------------------------------------------------------


scene :: DSL 'E () -> AFrame
scene m = case run prog 0 of
             ([], [f], _) -> f
             (_,  [],  _) -> error "scene internal error: no top-level primitive"
             (_,  [_], _) -> error "scene internal error: top-level attribute"
             (_,  _,   _) -> error "scene internal error: to many top-level primitives"
  where prog = entity "scene" m

run :: DSL k () -> Int -> ([Attribute],[AFrame],Int)
run (Pure a) i = ([],[],i)
run (Bind (Node nm m0) m) i0 = (attrs,AFrame (Primitive nm) attrs0 frames0:frames,i2)
  where (attrs0,frames0,i1) = run m0 i0
        (attrs,frames,i2)   = run m i1
run (Bind (Attr a p) m) i0 = ((a,p):attrs,frames,i1)
  where (attrs,frames,i1) = run m i0


data E = E -- entity level
       | A -- (embedded) attribute level

data Item where
  Node :: Text -> DSL (k :: E) () -> Item
  Attr :: Label -> Property       -> Item

instance ToProperty Text where
  toProperty = Property

instance ToProperty (Double,Double,Double) where
  toProperty (a,b,c) = Property $ pack $ unwords $ map show' [a,b,c]
   where show' a = showFFloat Nothing a ""


---------------------------------------------------------------------------------------------------------
-- Entities

aImage :: DSL 'E () -> DSL 'E ()
aImage = entity "a-image"

aEntity :: DSL 'E () -> DSL 'E ()
aEntity = entity "a-entity"

---------------------------------------------------------------------------------------------------------
-- Components

position :: Component k => (Double,Double,Double) -> k ()
position = component "position"

rotation :: Component k => (Double,Double,Double) -> k ()
rotation = component "rotation"

src :: Component k => Text -> k ()
src = component "src"

template :: Component k => List Attribute () -> k ()
template = component "template"

{-
-- component :: -- overloaded to argument, used to specify components, with mono types
-- provide a way of translating back to the Haskell-ish type as part of the overloading.

-}
{-
prim :: Text -> DSL E () -> DSL E ()
prim nm m = Bind (Node nm m) (Pure ())

-- | Attributes can be at the (E)ntity or the [embedded] (A)ttribute level.
attr :: Label -> Property -> DSL k ()
attr a p = Bind (Attr a p) (Pure ())

emAttr :: Label -> DSL A () -> DSL E ()
emAttr a p = undefined
-}
------------------------------------------------------
-- primitives


example3 :: AFrame
example3 = scene $ do
  aEntity $ do
    template $ src "#boxes"
    position (0,2,0)
    rotation (0,0,0)
{-

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
    
    

-}