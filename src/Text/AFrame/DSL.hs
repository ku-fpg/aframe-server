{-# LANGUAGE GADTs, OverloadedStrings, StandaloneDeriving, KindSignatures, DataKinds, DeriveFunctor, FlexibleInstances, InstanceSigs, RankNTypes #-}
-- | Small monadic DSL for AFrame generation.
module Text.AFrame.DSL 
  (  -- * Entity DSL
    DSL,
    scene,
    animation,
    assets,
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
    -- * Asset DSL
    img,
    -- * Component DSL
    fog,
    look_at,
    material,
    position,
    rotation,
    scale,
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
    id_,
    lookControlsEnabled,
    metalness,
    opacity,
    open,
    radius,
    radiusTop,
    radiusBottom,
    repeat_,
    roughness,
    src,
    to,
    transparent,
    wasdControlsEnabled,
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
    Attributes, 
    DynamicProperty,
    -- * FRP operators
    colorSelector,
    numberSelector,
    vec3Selector,
    selectionFolder,
    now,
    (?),
    -- * Variable Types
    Color,
    Number,
    -- * Unique Property generator
    uniqId,
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
import Text.AFrame
import Data.Monoid ((<>))
import Data.Maybe (catMaybes)
import Numeric

---------------------------------------------------------------------------------

class Component f where
  component :: DynamicProperty c => Label -> c -> f ()

class Attributes f where
  attribute :: DynamicProperty c => Label -> c -> f ()

class (Attributes f, Component f) => PrimitiveEntity f where
  primitiveEntity :: Text -> f a -> f a

class ToProperty c => DynamicProperty c where
  toDynamicProperty :: c -> Maybe Expr
  toDynamicProperty _ = Nothing
  
instance DynamicProperty Text 
instance DynamicProperty Bool
instance DynamicProperty Double
instance DynamicProperty Int
instance DynamicProperty ()
instance DynamicProperty (List Attribute ())
instance DynamicProperty (Double,Double,Double)
instance DynamicProperty Property

---------------------------------------------------------------------------------
-- Primitive DSL

newtype DSL a = DSL { runDSL :: Int -> (a,Int,[Attribute],[AFrame],[(Label,Expr)]) }

instance Functor DSL where
  fmap f g = pure f <*> g

instance Applicative DSL where
  pure = return
  (<*>) = ap

instance Monad DSL where
  return a = DSL $ \ i -> (a,i,[],[],[])
  DSL m >>= k2 = DSL $ \ i0 -> case m i0 of
     (r1,i1,as1,af1,gs1) -> case runDSL (k2 r1) i1 of
                             (r2,i2,as2,af2,gs2) -> (r2,i2,as1 ++ as2,af1 ++ af2,gs1 ++ gs2)

instance PrimitiveEntity DSL where
  primitiveEntity :: Text -> DSL a -> DSL a
  primitiveEntity nm m = DSL $ \ i0 -> case runDSL m i0 of
     (r1,i1,as1,af1,gs1) -> (r1,i1,[],[AFrame (Primitive nm) (compile gs1 as1) af1],[])
    where compile gs as | code == "" = as
                        | otherwise  = ("behavior",code) : as
             where code = compileExprs gs

                    
instance Component DSL where
  component :: DynamicProperty c => Label -> c -> DSL ()
  component lab c = DSL $ \ i0 -> ((),i0,[(lab,toProperty c)],[],[(lab,p) | Just p <- [toDynamicProperty c]])

instance Attributes DSL where
  attribute :: DynamicProperty c => Label -> c -> DSL ()
  attribute lab c = DSL $ \ i0 -> ((),i0,[(lab,toProperty c)],[],[(lab,p) | Just p <- [toDynamicProperty c]])

uniqId :: DSL Property
uniqId = DSL $ \ i -> (Property (pack $ "id_" ++ show i),i+1,[],[],[])

scene :: DSL () -> AFrame
scene m = case runDSL (primitiveEntity "a-scene" m) 0 of
             (_, _, [], [f], _) -> f
             (_, _, _,  [] , _) -> error "scene internal error: no top-level primitiveEntity"
             (_, _, _,  [_], _) -> error "scene internal error: top-level attribute"
             (_, _, _,  _  , _) -> error "scene internal error: to many top-level primitiveEntitys"


guessLabel :: DSL () -> Maybe Label
guessLabel m = case runDSL m 0 of
                ((),_,[(lab,_)],_,_) -> return lab
                _                    -> Nothing

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
-- Primitives

entity :: DSL a -> DSL a
entity = primitiveEntity "a-entity"

animation :: DSL a -> DSL a
animation = primitiveEntity "a-animation"

assets :: DSL a -> DSL a
assets = primitiveEntity "a-assets" 

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
-- Assets

img :: DSL a -> DSL a
img = primitiveEntity "img"

---------------------------------------------------------------------------------------------------------
-- Components

fog :: Component k => List Attribute () -> k ()
fog = component "fog"

-- | 'look_at' takes a selector or a vec3.
look_at :: Component k => Property -> k ()
look_at = component "look-at"	      -- TODO: revisit this to consider overloading

material :: Component k => List Attribute () -> k ()
material = component "material"

position :: Component k => (Number,Number,Number) -> k ()
position = component "position"

rotation :: Component k => (Number,Number,Number) -> k ()
rotation = component "rotation"

scale :: Component k => (Number,Number,Number) -> k ()
scale = component "scale"

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

color :: Attributes k => Color -> k ()
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

height :: Attributes k => Number -> k ()
height = attribute "height"

id_ :: Attributes k => Text -> k ()
id_ = attribute "id" 

lookControlsEnabled :: Attributes k => Bool -> k ()
lookControlsEnabled = attribute "look-controls-enabled" 

metalness :: Attributes k => Number -> k ()
metalness = attribute "metalness"

open :: Attributes k => Bool -> k ()
open = attribute "open"

opacity :: Attributes k => Number -> k ()
opacity = attribute "opacity"

radius :: Attributes k => Number -> k ()
radius = attribute "radius"

radiusTop :: Attributes k => Number -> k ()
radiusTop = attribute "radius-top"

radiusBottom :: Attributes k => Number -> k ()
radiusBottom = attribute "radius-bottom"

repeat_ :: Attributes k => Text -> k ()
repeat_ = attribute "repeat"

roughness :: Attributes k => Number -> k ()
roughness = attribute "roughness"

src :: Attributes k => Text -> k ()
src = attribute "src"

to :: Attributes k => Text -> k ()
to = attribute "to"

transparent :: Attributes k => Bool -> k ()
transparent = attribute "transparent"

wasdControlsEnabled :: Attributes k => Bool -> k ()
wasdControlsEnabled = attribute "wasd-controls-enabled" 

width :: Attributes k => Number -> k ()
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
-- Expressions

data Expr :: * where
  Var    :: Text ->                 Expr
  LitNumber :: Double ->            Expr    -- 2.23
  LitText   :: Text ->              Expr    -- "LDC#"
  Infix  :: Text -> Expr -> Expr -> Expr
  Prim0  :: Text                 -> Expr
  Prim1  :: Text -> Expr         -> Expr
  Prim2  :: Text -> Expr -> Expr -> Expr
  Vec3   :: Expr -> Expr -> Expr -> Expr
  deriving Show

data Dynamic :: * -> * where
  Dynamic :: Expr -> a -> Dynamic a
  deriving (Show, Functor)

static :: (a -> Expr) -> a -> Dynamic a
static f a = Dynamic (f a) a

-- It is *always* possible to constant fold to the initual value  
initial :: Dynamic a -> a
initial (Dynamic _ a) = a

infixOp :: Text -> (a -> a -> a) -> Dynamic a -> Dynamic a -> Dynamic a
infixOp nm f (Dynamic e1 i1) (Dynamic e2 i2) = Dynamic (Infix nm e1 e2) (f i1 i2)

prim0 :: Text -> a -> Dynamic a
prim0 nm a = Dynamic (Prim0 nm) a 

prim1 :: Text -> (a -> b) -> Dynamic a -> Dynamic b
prim1 nm f (Dynamic e1 i1) = Dynamic (Prim1 nm e1) (f i1)

prim2 :: Text -> (a -> b -> c ) -> Dynamic a -> Dynamic b -> Dynamic c
prim2 nm f (Dynamic e1 i1) (Dynamic e2 i2) = Dynamic (Prim2 nm e1 e2) (f i1 i2) 

--functionOp :: Text -> (a -> a -> a) -> Dynamic a -> Dynamic a -> Dynamic a
--functionOp nm f e1 e2 = Infix nm e1 e2 (f (initial e1) (initial e2))

compileExprs :: [(Label,Expr)] -> Property
compileExprs = Property 
             . T.intercalate "; " 
             . catMaybes
             . map (\ (Label lbl,e) -> 
                   if constant e
                   then Nothing
                   else Just (lbl <> " = " <> compile e))
  where
    constant (LitNumber {})  = True
    constant (LitText   {})  = True
    constant (Infix _ e1 e2) = constant e1 && constant e2
    constant (Prim1 _ e1)    = constant e1
    constant (Prim2 _ e1 e2) = constant e1 && constant e2
    constant (Vec3 e1 e2 e3) = constant e1 && constant e2 && constant e3
    constant _               = False

    compile (Var uq) = "id('" <> uq <> "')"
    compile (Infix op e1 e2) = "(" <> compile e1 <> op <> compile e2 <> ")"
    compile (LitNumber n) = t
        where Property t = toProperty n
    compile (LitText txt) = "'" <> txt <> "'"
    compile (Prim0 nm) = nm
    compile (Prim1 nm e1) = nm <> "(" <> compile e1 <> ")"
    compile (Prim2 nm e1 e2) = nm <> "(" <> compile e1 <> "," <> compile e2 <> ")"
    compile (Vec3 e1 e2 e3) = "vec3(" <> compile e1 <> "," <> compile e2 <> "," <> compile e3 <> ")"
    compile other = error $ "compile: " ++ show other

------------------------------------------------------
-- Color

newtype Color = Color (Dynamic Text)

instance Show Color where
  show (Color c) = show (initial c)

instance ToProperty Color where
  toProperty (Color e) = Property $ initial e

instance DynamicProperty Color where
  toDynamicProperty (Color (Dynamic e _)) = return e

instance IsString Color where
  fromString = Color . static LitText . pack

------------------------------------------------------
-- Numbers

newtype Number = Number (Dynamic Double)

now :: Number 
now = Number (prim0 "now" 0)

instance Show Number where
  show (Number c) = show (initial c)

instance ToProperty Number where
  toProperty (Number e) = toProperty (initial e)

instance DynamicProperty Number where
  toDynamicProperty (Number (Dynamic e _)) = return $ e

instance ToProperty (Number,Number,Number) where
  toProperty (Number a,Number b,Number c) 
     = Property $ pack $ unwords $ [ unpack p | Property p <- map (toProperty . initial) [a,b,c] ]

instance DynamicProperty (Number,Number,Number) where
  toDynamicProperty (Number (Dynamic e1 _),Number (Dynamic e2 _),Number (Dynamic e3 _)) 
    = return $ Vec3 e1 e2 e3

--      ‘+’, ‘*’, ‘abs’, ‘signum’, and (either ‘negate’ or ‘-’)
instance Num Number where
  (Number n1) - (Number n2) = Number (infixOp "-" (-) n1 n2)
  (Number n1) + (Number n2) = Number (infixOp "+" (+) n1 n2)
  (Number n1) * (Number n2) = Number (infixOp "*" (*) n1 n2)
  fromInteger = Number . static LitNumber . fromInteger

instance Fractional Number where
  (Number n1) / (Number n2) = Number (infixOp "/" (/) n1 n2)
  fromRational = Number . static LitNumber . fromRational

instance Floating Number where
  pi = Number (prim0 "pi" pi)
  sin (Number n) = Number (prim1 "sin" sin n)
  cos (Number n) = Number (prim1 "cos" cos n)
  sqrt (Number n) = Number (prim1 "sqrt" sqrt n)
  asin (Number n) = Number (prim1 "asin" asin n)

------------------------------------------------------
-- Selectors

selectionFolder :: Text -> DSL a -> DSL a
selectionFolder txt inner = do
  primitiveEntity "a-selection-folder" $ do
    attribute "name"  txt
    inner

colorSelector :: Text -> Color -> DSL Color
colorSelector txt (Color e) = do
  Property uq <- uniqId
  let start = initial e
  primitiveEntity "a-color-selector" $ do
    id_ uq
    attribute "value" start
    attribute "name"  txt
    return $ Color $ Dynamic (Var uq) start

numberSelector :: Text -> Double -> Maybe (Double,Double) -> DSL Number
numberSelector txt start lowHigh = do
  Property uq <- uniqId
  primitiveEntity "a-number-selector" $ do
    id_ uq
    attribute "value" start
    attribute "name"  txt
    case lowHigh of
      Just (low,high) -> do
        attribute "min"   low
        attribute "max"   high
      Nothing -> return ()
              
    return $ Number $ Dynamic (Var uq) $ start


vec3Selector :: Text -> (Double,Double,Double) -> (Double,Double) -> DSL (Number,Number,Number)
vec3Selector nm (x,y,z) (mx,mn) = do
  selectionFolder nm $ do
    x <- numberSelector "x" x $ return (mx,mn)
    y <- numberSelector "y" y $ return (mx,mn)
    z <- numberSelector "z" z $ return (mx,mn)
    return (x,y,z)

class EditProperty p where
  (?) :: (p -> DSL a) -> p -> DSL a

instance EditProperty (Number,Number,Number) where
  fn ? a@(Number x,Number y,Number z) = do
          let x0 = initial x
              y0 = initial y
              z0 = initial z
              mx = maximum [x0,y0,z0]
              mn = minimum [x0,y0,z0]
              (txt,range) = case guessLabel (pure () <* fn a) of
                       Just lab | lab == "rotation" -> ("rotation", return (min (-180) mn , max 360 mx))
                                | lab == "scale"    -> ("scale",    return (min (-1) mn   , max 10 mx))
                                | lab == "position" -> ("position", return (min (-10) mn  , max 10 mx))
                       _                            -> ("vec3",     Nothing)
                       
          (x,y,z) <- selectionFolder txt $ do
            x <- numberSelector "x" x0 range
            y <- numberSelector "y" y0 range
            z <- numberSelector "z" z0 range
            return $ (x,y,z)
          fn (x,y,z)


instance EditProperty Number where
  fn ? (Number x) = do
          let x0 = initial x
              range = Nothing
          x <- numberSelector "number" x0 range
          fn x

instance EditProperty Color where
  fn ? c = do
          x <- colorSelector "color" c
          fn x


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

