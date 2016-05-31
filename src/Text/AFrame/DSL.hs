{-# LANGUAGE GADTs, OverloadedStrings, KindSignatures, DataKinds, FlexibleInstances, InstanceSigs #-}
-- | Small monadic DSL for AFrame generation.
module Text.AFrame.DSL 
  (  -- * Entity DSL
    DSL,
    scene,
    aImage,
    aEntity,
    -- * Component DSL
    position,
    rotation,
    src,
    template,
    -- * Property builder sub-DSL
    List,
    -- * DSL classes
    ToProperty,
    Entity,
    entity,
    Component,
    component,
  ) where



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
-- Entity DSL

newtype DSL a = DSL { runDSL :: Int -> (a,Int,[Attribute],[AFrame]) }

instance Functor DSL where
  fmap f g = pure f <*> g

instance Applicative DSL where
  pure = return
  (<*>) = ap

instance Monad DSL where
  return a = DSL $ \ i -> (a,i,[],[])
  DSL m >>= k2 = DSL $ \ i0 -> case m i0 of
     (r1,i1,as1,af1) -> case runDSL (k2 r1) i1 of
                        (r2,i2,as2,af2) -> (r2,i2,as1 ++ as2,af1 ++ af2)

instance Entity DSL where
  entity :: Text -> DSL () -> DSL ()
  entity nm m = DSL $ \ i0 -> case runDSL m i0 of
     (r1,i1,as1,af1) -> (r1,i1,[],[AFrame (Primitive nm) as1 af1])
                    
instance Component DSL where
  component :: ToProperty c => Label -> c -> DSL ()
  component lab c = DSL $ \ i0 -> ((),i0,[(lab,toProperty c)],[])


scene :: DSL () -> AFrame
scene m = case runDSL (entity "scene" m) 0 of
             (_, _, [], [f]) -> f
             (_, _, _,  [] ) -> error "scene internal error: no top-level primitive"
             (_, _, _,  [_]) -> error "scene internal error: top-level attribute"
             (_, _, _,  _  ) -> error "scene internal error: to many top-level primitives"

---------------------------------------------------------------------------------
-- Properties DSL

data List x a where
  List :: [x] -> a -> List x a
  
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

instance Component (List Attribute) where
  component lab c = List [(lab,toProperty c)] ()

---------------------------------------------------------------------------------------------------------
-- ToProperty overloadings

instance ToProperty Text where
  toProperty = Property

instance ToProperty (Double,Double,Double) where
  toProperty (a,b,c) = Property $ pack $ unwords $ map show' [a,b,c]
   where show' a = showFFloat Nothing a ""

---------------------------------------------------------------------------------------------------------
-- Entities

aImage :: DSL () -> DSL ()
aImage = entity "a-image"

aEntity :: DSL () -> DSL ()
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

------------------------------------------------------
-- Examples

example3 :: AFrame
example3 = scene $ do
  aEntity $ do
    template $ src "#boxes"
    position (0,2,0)
    rotation (0,0,0)
