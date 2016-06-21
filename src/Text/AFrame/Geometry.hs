module Text.AFrame.Geometry where
  
-- A-Frame uses a right-handed coordinate system. 
-- When aligning our right hand’s thumb with a positive axis,
-- our hand will curl in the positive direction of rotation.

newtype Geometry a = Geometry ((a,a,a) -> (a,a,a))

type Position a = (a,a,a)

type Rotation a = (a,a,a) -- in degrees

type Scale a    = (a,a,a)

instance Monoid (Geometry a) where
  mempty = Geometry id
  Geometry f `mappend` Geometry g = Geometry (f . g)

position :: Num a => Position a -> Geometry a
position (xd,yd,zd) = Geometry $ \ (x,y,z) -> (x + xd,y + yd,z + zd)

-- 'rotation' is in degrees
rotation :: Floating a => Rotation a -> Geometry a
rotation (xd,yd,zd) = Geometry $ \ (x0,y0,z0) -> 
    let (x1,(y1,z1)) = (x0,rot xd (y0,z0))
        (y2,(x2,z2)) = (y1,rot (-yd) (x1,z1))
        (z3,(x3,y3)) = (z2,rot zd (x2,y2))
    in  (x3,y3,z3)
  where
   rot d (x,y) = ( x * cos r - y * sin r
                 , x * sin r + y * cos r
                 )
     where r = d / 180 * pi

scale :: Num a => Scale a -> Geometry a
scale (xd,yd,zd) = Geometry $ \ (x0,y0,z0) -> (xd * x0, yd * y0, zd * z0)

run :: Geometry a -> (a,a,a) -> (a,a,a)
run (Geometry f) = f