module Text.AFrame.Geometry where

import Control.Monad  
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
-- So we need to do Z, then X, then Y. apparently.
rotation :: Floating a => Rotation a -> Geometry a
rotation (xd,yd,zd) = Geometry $ \ (x0,y0,z0) -> 
    let (z1,(x1,y1)) = (z0,rot zd (x0,y0))
        (x2,(y2,z2)) = (x1,rot xd (y1,z1))
        (y3,(x3,z3)) = (y2,rot' yd (x2,z2))
    in  (x3,y3,z3)
  where
   rot d (x,y) = ( x * cos r - y * sin r
                 , x * sin r + y * cos r
                 )
     where r = d / 180 * pi

   rot' d (x,y) =( x * cos r + y * sin r
                 , -(x * sin r) + y * cos r
                 )
     where r = d / 180 * pi

scale :: Num a => Scale a -> Geometry a
scale (xd,yd,zd) = Geometry $ \ (x0,y0,z0) -> (xd * x0, yd * y0, zd * z0)

run :: Geometry a -> (a,a,a) -> (a,a,a)
run (Geometry f) = f
{-
vectorDirection :: RealFloat a => XYZ -> Position a -> Position a -> Rotation a
vectorDirection xyz (x0,y0,z0) (x1,y1,z1)
  | r == 0    = (0,0,0)
  | otherwise = (0,t,u)
 where
   x' = x1 - x0
   y' = y1 - y0
   z' = z1 - z0
   (x,y,z) = (x',y',z')
   r = sqrt (x^2 + y^2 + z^2)
   t = (180/pi) * asin (z / r)            -- polar angle, "latitude", 0 .. pi/2
   u = (180/pi) * atan2 y x               -- azimuth angle, "longiture", -pi .. pi
      
   
test :: (Double,Double,Double) -> String
test p = show (p,r',p')
  where
  r' = vectorDirection XYZ (0,0,0) p
  p' = run (rotation r') (1,0,0)

prop = do
  x <- [-1,0,1]    
--  y <- [0]
--  z <- [0]
  y <- [-1,0,1]    
  z <- [-1,0,1]    
  [ test (x,y,z) | x /= 0 || y /= 0 || z /= 0 ]
    
-}
