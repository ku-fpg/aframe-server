{-# LANGUAGE GADTs, ScopedTypeVariables, InstanceSigs #-}
module Text.AFrame.Geometry where

import Control.Monad  
import Data.Monoid ((<>))
import Control.Applicative ((<|>))

import Debug.Trace
import Test.QuickCheck

--------------------------------------------------------------------------------------------------------

-- A-Frame uses a right-handed coordinate system. 
-- When aligning our right hand’s thumb with a positive axis,
-- our hand will curl in the positive direction of rotation.

-- When using Geometry, use (position p <> G.rotation YXZ r <>  scale s)
-- aka scale, then rotate, then position.

newtype Geometry a = Geometry (Position a -> Position a)

newtype Position a  = Position (a,a,a) -- in units, x,y,z
        deriving Show

newtype Rotation a = Rotation (a,a,a) -- in degrees, x,y,z
        deriving Show

newtype Vector a = Vector (a,a,a) -- in units, x,y,z
        deriving Show

newtype Normal a   = Normal (a,a,a) -- unit length, x,y,z
        deriving Show
        
newtype Scale a    = Scale (a,a,a) -- ratio, x,y,z
        deriving Show

data Order = XYZ | XZY | YXZ | YZX | ZXY | ZYX

instance Num a => Num (Vector a) where
  Vector (x0,y0,z0) + Vector (x1,y1,z1) = Vector (x0+x1,y0+y1,z0+z1)
  Vector (x0,y0,z0) - Vector (x1,y1,z1) = Vector (x0-x1,y0-y1,z0-z1)
  Vector (x0,y0,z0) * Vector (x1,y1,z1) = Vector (x0*x1,y0*y1,z0*z1)
  negate (Vector (x0,y0,z0)) = Vector (negate x0,negate y0,negate z0)
  abs = error "abs not defined"
  signum = error "signum not defined"
  fromInteger n = Vector (fromInteger n,fromInteger n,fromInteger n)

instance Foldable Vector where
  foldr f z (Vector (a,b,c)) = f a (f b (f c z))


instance Monoid (Geometry a) where
  mempty = Geometry id
  Geometry f `mappend` Geometry g = Geometry (f . g)

-- Not sure about the Floating here. Feel that it can be embeded inside Geometry, for example.
class Geometric g where
  run :: Floating a => Geometry a -> g a -> g a

class Geometric p => Polygon p where
  path  :: p a -> [Position a]

--------------------------------------------------------------------------------------------------------
-- The three 'Geometry' generators,  a 'perspective' modifier,

position :: Num a => (a,a,a) -> Geometry a
position (xd,yd,zd) = Geometry $ \ (Position (x,y,z)) -> Position (x + xd,y + yd,z + zd)

-- 'rotation' is in degrees

-- From aframe/src/components/rotation.js, 
--   object3D.rotation.order = 'YXZ';
--
-- Rotations are performed with respect to the object's internal coordinate system -- not the world coordinate system. 
-- This is important. So, for example, after the x-rotation occurs, the object's y- and z- axes will generally no 
-- longer be aligned with the world axes. Rotations specified in this way are not unique.
--
-- From http://stackoverflow.com/questions/14774633/how-to-rotate-an-object-and-reset-its-rotation-to-zero/14776900#14776900
-- For more information about Euler angles, see the Wikipedia article <https://en.wikipedia.org/wiki/Euler_angles>
-- Three.js follows the Tait–Bryan convention, as explained in the article.

-- Quote: .. about the axes of the rotating coordinate system, 
-- which changes its orientation after each elemental rotation (intrinsic rotations).

rotation :: Floating a => Order -> (a,a,a) -> Geometry a
rotation order (xd,yd,zd) = Geometry $ runPosition $ case order of
      YXZ -> rotY . rotX . rotZ 
       -- This seems reversed to me, this is because
       -- aframe/THREE uses intrinsic, and have extrinsic rotations.
       -- any intrinsic rotation can be converted to its extrinsic
       -- equivalent and vice-versa by reversing the order of elemental rotations.
       -- From: http://danceswithcode.net/engineeringnotes/rotations_in_3d/rotations_in_3d_part1.html
  where
   runPosition f (Position p) = Position $ f p


   rotX (x,y,z) = (x, y',z') where (y',z') = rot xd    (y,z)
   rotY (x,y,z) = (x',y ,z') where (x',z') = rot (-yd) (x,z)
   rotZ (x,y,z) = (x',y',z ) where (x',y') = rot zd    (x,y)

   rot d (x,y) = ( x * cos r - y * sin r
                 , x * sin r + y * cos r
                 )
     where r = d / 180 * pi

scale :: Num a => (a,a,a) -> Geometry a
scale (xd,yd,zd) = Geometry $ \ (Position (x0,y0,z0)) -> Position (xd * x0, yd * y0, zd * z0)

-- assuming we are looking at the -ve side of the z axis.
perspective :: Fractional a => Geometry a
perspective = Geometry $ \ (Position (x,y,z)) -> Position (x/(-z),y/(-z),z)

--------------------------------------------------------------------------------------------------------
--  The class instances for Geometric.

instance Geometric Position where
  run :: Geometry a -> Position a -> Position a
  run (Geometry f) = f

instance Geometric Vector where
--  run :: Floating a => Geometry a -> Vector a -> Vector a
  run g (Vector p) = Vector $ p'
    where Position (x,y,z) = run                         g  $ origin
          Position p'      = run (position (-x,-y,-z) <> g) $ Position p

instance Geometric Normal where
  run :: Floating a => Geometry a -> Normal a -> Normal a
  run g (Normal p) = normalize $ run g $ Vector p

{-
runNormal :: Floating a => Geometry a -> Normal a -> Normal a
runNormal g (Normal p) = normalize $ Vector $ p'
  where Position (x,y,z) = run                         g  $ Position (0,0,0)
        Position p'      = run (position (-x,-y,-z) <> g) $ Position p
-}

--------------------------------------------------------------------------------------------------------
-- Misc linear alg. operators

origin :: Num a => Position a
origin = Position (0,0,0)

size :: Floating a => Vector a -> a
size (Vector (x,y,z)) = sqrt (x^2 + y^2 + z^2)

to :: Num a => Position a -> Position a -> Vector a
to (Position (x0,y0,z0)) (Position (x1,y1,z1)) = Vector (x1 - x0,y1 - y0,z1 - z0)

normalize :: Floating a => Vector a -> Normal a
normalize (Vector (x,y,z)) = (Normal (x/d,y/d,z/d))
  where d = size $ Position (0,0,0) `to` Position (x,y,z)

crossProduct :: Num a => Vector a -> Vector a -> Vector a
crossProduct (Vector (bx,by,bz)) (Vector (cx,cy,cz)) = Vector (ax,ay,az)
  where
      ax = by * cz - bz * cy
      ay = bz * cx - bx * cz
      az = bx * cy - by * cx

dotProduct :: Num a => Vector a -> Vector a -> a
dotProduct (Vector (bx,by,bz)) (Vector (cx,cy,cz)) = bx*cx + by*cy + bz*cz

------------------------------------------------------------------------------------------------

-- Depth sorting, where lower z-axis numbers mean behind 
data Quad a = Quad (Position a) (Position a) (Position a) (Position a)
  deriving Show
   -- must have the same normal.

instance Geometric Quad where
  run f (Quad p0 p1 p2 p3) = Quad (run f p0) 
                                  (run f p1)
                                  (run f p2)
                                  (run f p3)
        

instance Polygon Quad where
  path (Quad p0 p1 p2 p3) = [p0,p1,p2,p3]

data Triangle a = Triangle (Position a) (Position a) (Position a) 
  deriving Show

instance Polygon Triangle where
  path (Triangle p0 p1 p2) = [p0,p1,p2]

instance Geometric Triangle where
  run f (Triangle p1 p2 p3) = Triangle (run f p1) (run f p2) (run f p3)
  
data Stacking = Behind | InFront | Disjoint | Indeterminate
  deriving (Show,Eq)


-- Figure out how to rotate from the first normal to the second normal.
normalRotation :: (RealFloat a, Show a) => Normal a -> Normal a -> Geometry a
--normalRotation p0 p1 | traceShow ("nr",p0,p1) False = undefined
normalRotation (Normal (x0,y0,z0)) (Normal (x1,y1,z1)) = rotation YXZ (0,-(b0+b1),-(a0+a1))
  where
    a0 = (180/pi)* atan2 y0 x0
    a1 = (180/pi)* atan2 y1 x1

    b0 = (180/pi)* acos z0
    b1 = (180/pi)* acos z1


comparePolygon :: forall p a .(Show a, Ord a, RealFloat a,Polygon p) => p a -> p a -> Stacking
comparePolygon pa pb
--    | traceShow ("bs",bs) False = undefined
--    | traceShow ("as",as) False = undefined
    -- Is it trivial in the z axis?
    | minimum [ z | Position (x,y,z) <- as ] > maximum [ z | Position (x,y,z) <- bs] = InFront
    | maximum [ z | Position (x,y,z) <- as ] < minimum [ z | Position (x,y,z) <- bs] = Behind
    -- Are the seperate on the x or y axis?
    | minimum [ x | Position (x,y,z) <- as ] > maximum [ x | Position (x,y,z) <- bs] = Disjoint
    | maximum [ x | Position (x,y,z) <- as ] < minimum [ x | Position (x,y,z) <- bs] = Disjoint
    | minimum [ y | Position (x,y,z) <- as ] > maximum [ y | Position (x,y,z) <- bs] = Disjoint
    | maximum [ y | Position (x,y,z) <- as ] < minimum [ y | Position (x,y,z) <- bs] = Disjoint


    | and [ sum (a_cross * Vector xyz) <= ad' | Position xyz <- bs ]            = InFront
  
    | and [ sum (a_cross * Vector xyz) >= ad' | Position xyz <- bs ]            = Behind

    | and [ sum (b_cross * Vector xyz) <= bd' | Position xyz <- as ]            = Behind
  
    | and [ sum (b_cross * Vector xyz) >= bd' | Position xyz <- as ]            = InFront

    -- Otherwise, give up
    | otherwise = Indeterminate

  where
    as, bs :: [Position a]
    as@(as0@(Position as0'):as1:as2:_) = path pa
    bs@(bs0@(Position bs0'):bs1:bs2:_) = path pb

    a_cross = crossProduct (as0 `to` as1) (as0 `to` as2)
    b_cross = crossProduct (bs0 `to` bs1) (bs0 `to` bs2)

    ad' = sum (a_cross * Vector as0')
    bd' = sum (b_cross * Vector bs0')
    

eps :: Fractional a => a
eps = 0.00001

-- Do you intersect (x,y), a plane. If so, where.
-- Using http://www.scratchapixel.com/lessons/3d-basic-rendering/ray-tracing-rendering-a-triangle/moller-trumbore-ray-triangle-intersection

intersectQuad :: (Ord a, Fractional a) => Quad a -> (a,a) -> Maybe a
intersectQuad (Quad p0 p1 p2 p3) (x,y) = 
    intersectTriangle (Triangle p0 p1 p2) (x,y) <|> intersectTriangle (Triangle p2 p3 p0) (x,y)

-- takes a triangle, and returns the value along the z-axis from the xy-plane, if any.
intersectTriangle :: (Ord a, Fractional a) => Triangle a -> (a,a) -> Maybe a
intersectTriangle (Triangle p0 p1 p2) (x,y) 
    | det < eps          = Nothing -- interection too thin; we do culling.
    | u < 0 || u > 1     = Nothing 
    | v < 0 || u + v > 1 = Nothing
    | otherwise          = Just (-t) -- -ve because the z-axis, -ve is away, and +ve is closer.
  where
    dir  = Vector (0,0,-1)
    orig = Position (x,y,0)
      
    p0p1 = p0 `to` p1
    p0p2 = p0 `to` p2

    pvec = crossProduct dir p0p2
    det  = dotProduct p0p1 pvec
    
    invDet = 1 / det
    
    tvec = p0 `to` orig
    u = dotProduct tvec pvec * invDet

    qvec = crossProduct tvec p0p1
    v = dotProduct dir qvec * invDet
    
    t = dotProduct p0p2 qvec * invDet
------------------------------------------------------------------------------------
-- Testing

draw :: Double -> Char
draw n | n > 1.5 = '#'
       | n > 0.5 = '*'
       | otherwise = last $ show (round n :: Int)


splat :: ((Double,Double) -> Maybe Char) -> String
splat f = unlines 
        [ [ case f (x,y) of
              Nothing -> '.'
              Just c -> c
          | x <- fmap (*2) $ fmap (/xsz) $ fmap (subtract xsz) $ [0..(xsz*2)]
          ]
        | y <- reverse $ fmap (*2) $ fmap (/ysz) $ fmap (subtract ysz) $ [0..(ysz*2)]
        ]
 where
    xsz = 50
    ysz = 20

-- Quad goes counter-clock
plane :: Fractional a => a -> a -> Quad a
plane w h = Quad (Position (-w/2,h/2,0)) (Position (-w/2,-h/2,0)) (Position (w/2,-h/2,0)) (Position (w/2,h/2,0))

-- For testing

newtype Degree = Degree (Double,Double,Double)
 deriving Show

instance Arbitrary Degree where
  arbitrary = (\ a b c -> Degree (a,b,c))
                     <$> choose (-360,360)
                     <*> choose (-360,360)
                     <*> choose (-360,360)

-- Check comparePolygon function
prop_compare (Degree lr) (Degree rr) (Degree cr) =
--  trace (splat $ fmap (fmap draw) $ intersectQuads [p1,p2]) False
    forAll (elements points) $ \ (x,y) ->
    case (intersectQuad p1 (x,y), intersectQuad p2 (x,y)) of
      (Just z1,Just z2) -> case cmp of
        Behind          -> True ==> if z1 < z2 then True else trace (msg (x,y) z1 z2) False
        InFront         -> True ==> if z1 > z2 then True else trace (msg (x,y) z1 z2) False
        Disjoint        -> True ==> True
        Indeterminate   -> True ==> True -- trace (msg (x,y) z1 z2) False -- error "should never be indeterminate"
      _                 -> False ==> True
   where
     -- ((x,y),z1,z2,cmp)
     msg (x,y) z1 z2 = "\n" ++ 
       unlines [ "x: " ++ show x
               , "y: " ++ show y
               , "z1: " ++ show z1
               , "z2: " ++ show z2
               , "cmp: " ++ show cmp
               , "p1: " ++ show p1
               , "p2: " ++ show p2
               ] ++ (splat $ fmap (fmap draw) $ intersectQuads (if cmp==Behind then [p2,p1] else [p1,p2]))
                 ++ "\n"


     -- splat $ fmap (fmap draw) $ intersectQuads [p2,p1])


     points :: [(Double,Double)] 
     points = (0,0) : [(x,y) | Position (x,y,z) <- path p1 ++ path p2 ]

     common :: Geometry Double
     common = position (0,0,-5) <> rotation YXZ cr

     p1 :: Quad Double
     p1 = run (common <> position (-1.5,0,0) <> rotation YXZ lr) $ plane 2 2

     p2 :: Quad Double
     p2 = run (common <> position ( 1.5,0,0) <> rotation YXZ rr) $ plane 2 2
      
     cmp :: Stacking
     cmp = comparePolygon p1 p2

qtest = quickCheckWith stdArgs { maxSuccess = 10000, maxDiscardRatio = 1000, chatty = True } prop_compare

intersectQuads :: (Ord a, Fractional a) => [Quad a] -> (a,a) -> Maybe a
intersectQuads qs p = head $ [ Just r | Just r <- map (\ q' -> intersectQuad q' p) qs ] ++ [Nothing]

