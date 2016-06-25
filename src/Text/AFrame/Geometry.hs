{-# LANGUAGE GADTs, ScopedTypeVariables #-}
module Text.AFrame.Geometry where

import Control.Monad  
import Data.Monoid ((<>))

-- A-Frame uses a right-handed coordinate system. 
-- When aligning our right hand’s thumb with a positive axis,
-- our hand will curl in the positive direction of rotation.

newtype Geometry a = Geometry ((a,a,a) -> (a,a,a))

type Position a    = (a,a,a) -- in units, x,y,z

type Rotation a    = (a,a,a) -- in degrees, x,y,z

type Vector a      = (a,a,a) -- in units, x,y,z

type Normal a      = (a,a,a) -- unit length, x,y,z

type Geographic a  = (a,a)   -- Longitude and Latitude

type Scale a       = (a,a,a) -- ratio, x,y,z

data Order = XYZ | XZY | YXZ | YZX | ZXY | ZYX

instance Monoid (Geometry a) where
  mempty = Geometry id
  Geometry f `mappend` Geometry g = Geometry (f . g)

position :: Num a => Position a -> Geometry a
position (xd,yd,zd) = Geometry $ \ (x,y,z) -> (x + xd,y + yd,z + zd)

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

rotation :: Floating a => Order -> Rotation a -> Geometry a
rotation order (xd,yd,zd) = Geometry $ case order of
      YXZ -> rotY . rotX . rotZ 
       -- This seems reversed to me, but the test(s) work. 
       -- I think its something to do with intrinsic vs extrinsic rotations.
  where
   rotX (x,y,z) = (x, y',z') where (y',z') = rot xd    (y,z)
   rotY (x,y,z) = (x',y ,z') where (x',z') = rot (-yd) (x,z)
   rotZ (x,y,z) = (x',y',z ) where (x',y') = rot zd    (x,y)

   rot d (x,y) = ( x * cos r - y * sin r
                 , x * sin r + y * cos r
                 )
     where r = d / 180 * pi

scale :: Num a => Scale a -> Geometry a
scale (xd,yd,zd) = Geometry $ \ (x0,y0,z0) -> (xd * x0, yd * y0, zd * z0)

size :: Floating a => Vector a -> a
size (x,y,z) = sqrt (x^2 + y^2 + z^2)

to :: Num a => Position a -> Position a -> Vector a
to (x0,y0,z0) (x1,y1,z1) = (x1 - x0,y1 - y0,z1 - z0)

normalize :: Floating a => Normal a -> Normal a
normalize (x,y,z) = (x/d,y/d,z/d)
  where d = size $ (0,0,0) `to` (x,y,z)

runPosition :: Geometry a -> Position a -> Position a
runPosition (Geometry f) = f

runNormal :: Floating a => Geometry a -> Normal a -> Normal a
runNormal g = normalize . runPosition (position (-x,-y,-z) <> g)
  where (x,y,z) = runPosition g (0,0,0)

crossProduct :: Num a => Normal a -> Normal a -> Normal a
crossProduct (bx,by,bz) (cx,cy,cz) = (ax,ay,az)
  where
      ax = by * cz - bz * cy
      ay = bz * cx - bx * cz
      az = bx * cy - by * cx

dotProduct :: Num a => Normal a -> Normal a -> a
dotProduct (bx,by,bz) (cx,cy,cz) = bx*cx + by*cy + bz*cz


{-

prop_normalRotation (ANormal p1) (ANormal p2) = runPosition (rotation YXZ $ normalRotation p1 p2) p1 == p2

newtype ANormal = ANormal (Normal Double) deriving Show

instance Arbitrary ANormal where
  arbitrary = do (x,y,z) <- arbitrary
                 return $ ANormal $ runNormal (rotation YXZ (x,y,z)) $ (0,0,1)


-}
------------------------------------------------------------------------------------------------

-- Depth sorting, where lower z-axis numbers mean behind 

data Surface a = Surface [Position a] -- must have the same normal. Typically a triangle or (aligned) quad.

data Triangle a = Triangle (Position a) (Position a) (Position a) 

data Stacking = Behind | InFront | Disjoint | Indeterminate

comparePlanes :: (Ord a, Floating a) => Surface a -> Surface a -> Stacking
comparePlanes (Surface as) (Surface bs)
    -- Is it trivial in the z axis?
    | minimum [ z | (x,y,z) <- as ] > maximum [ z | (x,y,z) <- bs] = InFront
    | maximum [ z | (x,y,z) <- as ] < minimum [ z | (x,y,z) <- bs] = Behind
    -- Are the seperate on the x or y axis?
    | minimum [ x | (x,y,z) <- as ] > maximum [ x | (x,y,z) <- bs] = Disjoint
    | maximum [ x | (x,y,z) <- as ] < minimum [ x | (x,y,z) <- bs] = Disjoint
    | minimum [ y | (x,y,z) <- as ] > maximum [ y | (x,y,z) <- bs] = Disjoint
    | maximum [ y | (x,y,z) <- as ] < minimum [ y | (x,y,z) <- bs] = Disjoint
    -- Otherwise, give up
    | otherwise = Indeterminate
  where
    () = ()

--p1 = 

-- Do you intersect (x,y), a plane. If so, where.
-- Using http://www.scratchapixel.com/lessons/3d-basic-rendering/ray-tracing-rendering-a-triangle/moller-trumbore-ray-triangle-intersection

eps :: Fractional a => a
eps = 0.00001

-- takes a triangle, and returns the value along the z-axis from the xy-plane, if any.
intersect :: (Ord a, Fractional a) => Triangle a -> (a,a) -> Maybe a
intersect (Triangle p0 p1 p2) (x,y) 
    | abs det < eps      = Nothing -- interection too thin; we do not do culling.
    | u < 0 || u > 1     = Nothing 
    | v < 0 || u + v > 1 = Nothing
    | otherwise          = Just (-t) -- -ve because the z-axis, -ve is away, and +ve is closer.
  where
    dir  = (0,0,-1)
    orig = (x,y,0)
      
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


draw :: Double -> Char
draw n | n > 0.5   = '*'
       | otherwise = last $ show (round n :: Int)


splat :: ((Double,Double) -> Maybe Char) -> String
splat f = unlines 
        [ [ case f (x,y) of
              Nothing -> ' '
              Just c -> c
          | x <- fmap (*2) $ fmap (/xsz) $ fmap (subtract xsz) $ [0..(xsz*2)]
          ]
        | y <- reverse $ fmap (*2) $ fmap (/ysz) $ fmap (subtract ysz) $ [0..(ysz*2)]
        ]
 where
    xsz = 50
    ysz = 10

test = putStrLn $ splat $ fmap (fmap draw) $ intersect t1

t1 :: Triangle Double
t1 = Triangle (-1.2,1,-5) (1,1,5) (0,-2,-2)
