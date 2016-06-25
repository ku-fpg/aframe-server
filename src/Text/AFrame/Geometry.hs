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

distance :: Floating a => Position a -> Position a -> a
distance (x0,y0,z0) (x1,y1,z1) = sqrt (x^2 + y^2 + z^2)
  where (x,y,z) = (x1 - x0,y1 - y0,z1 - z0)

normalize :: Floating a => Normal a -> Normal a
normalize (x,y,z) = (x/d,y/d,z/d)
  where d = distance (0,0,0) (x,y,z)

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
