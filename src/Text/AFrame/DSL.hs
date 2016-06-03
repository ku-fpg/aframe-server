{-# LANGUAGE GADTs, OverloadedStrings, KindSignatures, DataKinds, FlexibleInstances, InstanceSigs, RankNTypes #-}
-- | Small monadic DSL for AFrame generation.
module Text.AFrame.DSL 
  (  -- * Entity DSL
    DSL,
    scene,
    animation,
    entity,
    box,
    camera,
    collada_model,
    cone,
    cursor,
    curvedimage,
    cylinder,
    image,
    light,
    obj_model,
    plane,
    ring,
    sky,
    sphere,
    torus,
    video,
    videosphere,
    -- * Component DSL
    fog,
    position,
    rotation,
    stats,
    template,
    wasd_controls,
    -- * Attribute DSL
    attribute,
    attribute_,
    begin,
    color,
    direction,
    dur,
    easing,
    fill,
    from,
    height,
    radius,
    repeat_,
    src,
    to,
    width,
    -- * DSL Macros
    fromTo,
    -- * Property builder sub-DSL
    List,
    Single,
    -- * DSL classes
    ToProperty,
    toProperty,
    PrimitiveEntity,
    primitiveEntity,
    Component,
    component,
    -- * Pretty Printer for DSL
    showAsDSL,
    -- * Others
    Attribute,
    Property,
    Label
  ) where



import Control.Monad
import Data.Text(Text,unpack,pack)
import qualified Data.Text as T
import Data.String
import Numeric
import Text.AFrame

---------------------------------------------------------------------------------

class ToProperty c where
  toProperty :: c -> Property

class Component f where
  component :: ToProperty c => Label -> c -> f ()

class Attributes f where
  attribute :: ToProperty c => Label -> c -> f ()

class (Attributes f, Component f) => PrimitiveEntity f where
  primitiveEntity :: Text -> f a -> f a

---------------------------------------------------------------------------------
-- Primitive DSL

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

instance PrimitiveEntity DSL where
  primitiveEntity :: Text -> DSL a -> DSL a
  primitiveEntity nm m = DSL $ \ i0 -> case runDSL m i0 of
     (r1,i1,as1,af1) -> (r1,i1,[],[AFrame (Primitive nm) as1 af1])
                    
instance Component DSL where
  component :: ToProperty c => Label -> c -> DSL ()
  component lab c = DSL $ \ i0 -> ((),i0,[(lab,toProperty c)],[])

instance Attributes DSL where
  attribute :: ToProperty c => Label -> c -> DSL ()
  attribute lab c = DSL $ \ i0 -> ((),i0,[(lab,toProperty c)],[])

scene :: DSL () -> AFrame
scene m = case runDSL (primitiveEntity "a-scene" m) 0 of
             (_, _, [], [f]) -> f
             (_, _, _,  [] ) -> error "scene internal error: no top-level primitiveEntity"
             (_, _, _,  [_]) -> error "scene internal error: top-level attribute"
             (_, _, _,  _  ) -> error "scene internal error: to many top-level primitiveEntitys"

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

instance Attributes (List Attribute) where
  attribute lab c = List [(lab,toProperty c)] ()

instance IsString (List Attribute ()) where
  fromString str = List (unpackProperty $ Property  $ pack $ str) ()

---------------------------------------------------------------------------------------------------------
-- Single DSL, with no monadic support (by design)

data Single x a where
  Single :: x -> Single x ()

instance Attributes (Single Attribute) where
  attribute lab c = Single (lab,toProperty c)

instance Component (Single Attribute) where
  component lab c = Single (lab,toProperty c)

---------------------------------------------------------------------------------------------------------
-- ToProperty overloadings

instance ToProperty Text where
  toProperty = Property

instance ToProperty Property where
  toProperty = id

instance ToProperty (Double,Double,Double) where
  toProperty (a,b,c) = Property $ pack $ unwords $ map show' [a,b,c]
   where show' v = showFFloat Nothing v ""

instance ToProperty Double where
  toProperty = Property . pack . show' 
   where show' v = showFFloat Nothing v ""

instance ToProperty Int where
  toProperty = Property . pack . show

instance ToProperty () where
  toProperty () = Property ""

instance ToProperty Bool where
  toProperty True  = Property "true"
  toProperty False = Property "false"

---------------------------------------------------------------------------------------------------------
-- Primitives

entity :: DSL a -> DSL a
entity = primitiveEntity "a-entity"

animation :: DSL a -> DSL a
animation = primitiveEntity "a-animation"

box :: DSL a -> DSL a
box = primitiveEntity "a-box"

camera :: DSL a -> DSL a
camera = primitiveEntity "a-camera"

collada_model :: DSL a -> DSL a
collada_model = primitiveEntity "a-collada-model"

cone :: DSL a -> DSL a
cone = primitiveEntity "a-cone"

cursor :: DSL a -> DSL a
cursor = primitiveEntity "a-cursor"

curvedimage :: DSL a -> DSL a
curvedimage = primitiveEntity "a-curvedimage"

cylinder :: DSL a -> DSL a
cylinder = primitiveEntity "a-cylinder"

image :: DSL a -> DSL a
image = primitiveEntity "a-image"

light :: DSL a -> DSL a
light = primitiveEntity "a-light"

obj_model :: DSL a -> DSL a
obj_model = primitiveEntity "a-obj-model"

plane :: DSL a -> DSL a
plane = primitiveEntity "a-plane"

ring :: DSL a -> DSL a
ring = primitiveEntity "a-ring"

sky :: DSL a -> DSL a
sky = primitiveEntity "a-sky"

sphere :: DSL a -> DSL a
sphere = primitiveEntity "a-sphere"

torus :: DSL a -> DSL a
torus = primitiveEntity "a-torus"

video :: DSL a -> DSL a
video = primitiveEntity "a-video"

videosphere :: DSL a -> DSL a
videosphere = primitiveEntity "a-videosphere"

---------------------------------------------------------------------------------------------------------
-- Components

fog :: Component k => List Attribute () -> k ()
fog = component "fog"

position :: Component k => (Double,Double,Double) -> k ()
position = component "position"

rotation :: Component k => (Double,Double,Double) -> k ()
rotation = component "rotation"

stats :: Component k => k ()
stats = component "stats" ()

template :: Component k => List Attribute () -> k ()
template = component "template"

wasd_controls :: Component k => List Attribute () -> k ()
wasd_controls = component "wasd-controls"

------------------------------------------------------
-- Attributes

attribute_ :: Attributes k => Text -> k ()
attribute_ = attribute "attribute"

begin :: Attributes k => Int -> k ()
begin = attribute "begin"

color :: Attributes k => Text -> k ()
color = attribute "color"

direction :: Attributes k => Text -> k ()
direction = attribute "direction"

dur :: Attributes k => Int -> k ()
dur = attribute "dur"

easing :: Attributes k => Text -> k ()
easing = attribute "easing"

fill :: Attributes k => Text -> k ()
fill = attribute "fill"

from :: Attributes k => Text -> k ()
from = attribute "from"

repeat_ :: Attributes k => Text -> k ()
repeat_ = attribute "repeat"

height :: Attributes k => Double -> k ()
height = attribute "height"

radius :: Attributes k => Double -> k ()
radius = attribute "radius"

src :: Attributes k => Text -> k ()
src = attribute "src"

to :: Attributes k => Text -> k ()
to = attribute "to"

width :: Attributes k => Double -> k ()
width = attribute "width"

------------------------------------------------------
-- Pretty Printer

showAsDSL :: AFrame -> String
showAsDSL (AFrame p0 as fs) = 
    showPrimitiveAsDSL p0 ++ " $ do\n" ++
    indent 2 (unlines (
        map showAttributeAsDSL as ++
        map showAsDSL fs))
  where
    showPrimitiveAsDSL :: Primitive -> String
    showPrimitiveAsDSL (Primitive "a-scene") = "scene"
    showPrimitiveAsDSL (Primitive p) | "a-" `T.isPrefixOf` p = drop 2 $ unpack p
    showPrimitiveAsDSL (Primitive p) = unpack p

    indent :: Int -> String -> String
    indent n = unlines . map (take n (repeat ' ') ++) . lines

    showAttributeAsDSL :: Attribute -> String
    showAttributeAsDSL (Label l,Property p) 
        | l `elem` ["width","height","radius"] = case () of
              _ | "-" `T.isPrefixOf` p -> unpack l ++ " (" ++ unpack p ++ ")"
              _                        -> unpack l ++ " " ++ unpack p
        | l `elem` ["position","rotation"] = case words $ unpack p of
            [a,b,c] -> unpack l ++ " (" ++ a ++ "," ++ b ++ "," ++ c ++ ")"
            _ -> def
        | l `elem` ["template"] = case unpackProperty (Property p) of
              xs -> unpack l ++ " $ do\n" ++
                      indent 2 (unlines (map showAttributeAsDSL xs))
        | otherwise = def
      where def = unpack l ++ " " ++ show (unpack p)


------------------------------------------------------
-- Macros

-- | 'fromTo' simplifies the animations, by allowing the specification
--   of 'attribute' 'from' and 'to' in a single line.
--
--  Example: toFrom position (1,2,3) (4,5,6) 
--

fromTo :: (Monad k, Attributes k, ToProperty c) => (c -> Single Attribute ()) -> c -> c -> k ()
fromTo f x y | lbl1 == lbl2 = do attribute "attribute" lbl1
                                 attribute "from"      a1
                                 attribute "to"        a2
             | otherwise = error "toFrom - the attribute builder was inconsistent"
  where
    Single (Label lbl1,Property a1) = f x
    Single (Label lbl2,Property a2) = f y

