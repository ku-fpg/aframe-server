{-# LANGUAGE GeneralizedNewtypeDeriving, ScopedTypeVariables, KindSignatures, GADTs, InstanceSigs, TypeOperators, MultiParamTypeClasses, FlexibleInstances, OverloadedStrings #-}

module Text.AFrame where

import Control.Applicative
import Data.Char (isSpace)
import Data.Generic.Diff
import Data.Map(Map)
import Data.String
import Data.Text(Text,pack,unpack)
import qualified Data.Text as T
import qualified Data.Text.Lazy as LT
import Data.Maybe (listToMaybe)
import Data.List as L
import Data.Monoid ((<>))
--import Text.XML.Light as X
import Data.Aeson
import Data.Monoid
import qualified Text.Taggy as T
import qualified Data.HashMap.Strict as H


-- | 'AFrame' describes the contents of an a-frame scene,
--   and is stored as a classical rose tree.
--   'AFrame' follows the DOM, except there are no textual  
--   content; it is tags all the way down. 
--
--   An xception is that \<script>ABC\</script> is encoded using 
--  \<script text=\"ABC\">\</script>

data AFrame       = AFrame Primitive [Attribute] [AFrame]
  deriving (Show, Eq)

newtype Primitive = Primitive Text
  deriving (Show, Eq, Ord, IsString, ToJSON, FromJSON)

newtype Label = Label Text
  deriving (Show, Eq, Ord, IsString, ToJSON, FromJSON)
  
newtype Property  = Property Text
  deriving (Show, Eq, Ord, IsString, ToJSON, FromJSON)

type Attribute = (Label,Property)

-- | A valid css or jquerty-style path, in Haskell from.
--   An example of the string form might be
--     $('a-scene > a-entity:nth-of-type(2) > a-collada-model:nth-of-type(1) > a-animation:nth-of-type(1)')
data Path = Path Primitive [(Int,Primitive)]
  deriving (Show, Eq, Ord)

-------------------------------------------------------------------------------------------------
instance ToJSON Path where
    toJSON (Path p ps) = toJSON $
               toJSON p : concat
            [ [toJSON i,toJSON p]
            | (i,p) <- ps
            ]

instance FromJSON Path where
    parseJSON as = do
        xs :: [Value] <- parseJSON as
        toPath xs
      where toPath [p] = do
                  txt <- parseJSON p
                  return $ Path txt []
            toPath (p1:i1:rest) = do
                  txt :: Primitive <- parseJSON p1
                  n   :: Int       <- parseJSON i1
                  Path p ps <- toPath rest
                  return $ Path txt ((n,p):ps)
            toPath _ = fail "bad Path"

-------------------------------------------------------------------------------------------------

setAttribute :: Label -> Property -> AFrame -> AFrame
setAttribute lbl prop (AFrame p as af) = AFrame p ((lbl,prop) : [ (l,p) | (l,p) <- as, l /= lbl ]) af

getAttribute :: Label -> AFrame -> Maybe Property
getAttribute lbl (AFrame p as af) = lookup lbl as

resetAttribute :: Label -> AFrame -> AFrame
resetAttribute lbl (AFrame p as af) = AFrame p [ (l,p) | (l,p) <- as, l /= lbl ] af

-------------------------------------------------------------------------------------------------

--setPath :: Path -> Label -> Property -> AFrame -> AFrame

--getPath :: Path -> Label -> AFrame -> Mabe Property

getElementById :: AFrame -> Text -> Maybe AFrame
getElementById af@(AFrame p as is) i = 
    case lookup "id" as of
      Just (Property i') | i == i' -> return af
      _ -> listToMaybe [ af' | Just af' <- map (flip getElementById i) is ]

-------------------------------------------------------------------------------------------------

-- | 'aFrameToElement' converts an 'AFrame' to an (XML) 'Element'. Total.
aFrameToElement :: AFrame -> T.Element
aFrameToElement (AFrame prim attrs rest) = T.Element prim' attrs' rest'
  where
    Primitive prim' = prim
    attrs'          = H.fromList
                    $ [ (a,p)
                      | (Label a,Property p) <- attrs 
                      , not (prim' == "script" && a == "text")
                      ]
    rest'           = [ T.NodeContent p
                      | (Label "text",Property p) <- attrs 
                      , prim' == "script" 
                      ]
                   ++ map (T.NodeElement . aFrameToElement) rest


-- | 'aFrameToElement' converts an (HTML) 'Element' to an 'AFrame'. Total.
-- Strips out any text (which is not used by 'AFrame' anyway.)
elementToAFrame :: T.Element -> AFrame
elementToAFrame ele = AFrame prim' attrs' content'
  where
    prim'    = Primitive $ T.eltName $ ele
    attrs'   = [ (Label a,Property p)| (a,p) <- H.toList $ T.eltAttrs ele ]
            ++ [ (Label "text",Property txt)| T.NodeContent txt <- T.eltChildren ele ]
    content' = [ elementToAFrame ele' | T.NodeElement ele' <- T.eltChildren ele ]

-- | reads an aframe document. This can be enbedded in an XML-style document (such as HTML)
readAFrame :: String -> Maybe AFrame
readAFrame str = do
    let doms = T.parseDOM True (LT.fromStrict $ pack str)
    case doms of
      [T.NodeElement dom] -> do
        let aframe  = elementToAFrame dom
        findAFrame aframe
      _ -> error $ show ("found strange DOM",doms)
  where 
    findAFrame :: AFrame -> Maybe AFrame
    findAFrame a@(AFrame (Primitive "a-scene") _ _) = return a
    findAFrame (AFrame _ _ xs) = listToMaybe
      [ x
      | Just x <- map findAFrame xs
      ]

showAFrame :: AFrame -> String
showAFrame = LT.unpack . T.renderWith False . aFrameToElement
    
-- | inject 'AFrame' into an existing (HTML) file. Replaces complete "<a-scene>" element.
injectAFrame :: AFrame -> String -> String
injectAFrame aframe str = findScene str 0 
  where
    openTag  = "<a-scene"
    closeTag = "</a-scene>"

    findScene :: String -> Int -> String
    findScene xs     n | openTag `L.isPrefixOf` xs = insertScene (drop (length openTag) xs) n
    findScene (x:xs) n =
       case x of
         ' '  -> x : findScene xs (n+1)
         _    -> x : findScene xs 0
    findScene [] n = []

    insertScene :: String -> Int -> String
    insertScene xs n = unlines (s : map (spaces ++) (ss ++ [remainingScene xs]))
     where
       (s:ss) = lines $ showAFrame $ aframe
       spaces = take n $ repeat ' '

    -- This will mess up if the closeTag strict appears in the scene.
    remainingScene :: String -> String
    remainingScene xs | closeTag `L.isPrefixOf` xs = drop (length closeTag) xs
    remainingScene (x:xs) = remainingScene xs
    remainingScene []     = []  
  
------
-- Adding gdiff support
------

data AFrameFamily :: * -> * -> * where
 AFrame'     ::              AFrameFamily AFrame      (Cons Primitive 
                                                      (Cons [Attribute] 
                                                      (Cons [AFrame] Nil)))
 ConsAttr'   ::              AFrameFamily [Attribute] (Cons Attribute (Cons [Attribute] Nil))
 NilAttr'    ::              AFrameFamily [Attribute] Nil
 ConsAFrame' ::              AFrameFamily [AFrame] (Cons AFrame (Cons [AFrame] Nil))
 NilAFrame'  ::              AFrameFamily [AFrame] Nil
 Primitive'  :: Primitive -> AFrameFamily Primitive Nil
 Attribute'  :: Attribute -> AFrameFamily Attribute Nil

instance Family AFrameFamily where
  decEq  :: AFrameFamily tx txs -> AFrameFamily ty tys -> Maybe (tx :~: ty, txs :~: tys)
  decEq AFrame'     AFrame'     = Just (Refl, Refl)
  decEq ConsAttr'   ConsAttr'   = Just (Refl, Refl)
  decEq NilAttr'    NilAttr'    = Just (Refl, Refl)
  decEq ConsAFrame' ConsAFrame' = Just (Refl, Refl)
  decEq NilAFrame'  NilAFrame'  = Just (Refl, Refl)

  decEq (Primitive' p1) (Primitive' p2) | p1 == p2 = Just (Refl, Refl)
  decEq (Attribute' a1) (Attribute' a2) | a1 == a2 = Just (Refl, Refl)
  decEq _           _           = Nothing

  fields :: AFrameFamily t ts -> t -> Maybe ts
  fields AFrame'        (AFrame prim attrs fs) 
                           = Just $ CCons prim $ CCons attrs $ CCons fs $ CNil
  fields ConsAttr'      ((lbl,prop):xs) 
                           = Just $ CCons (lbl,prop) $ CCons xs $ CNil
  fields NilAttr'       [] = Just CNil
  fields ConsAFrame'    (x:xs) 
                           = Just $ CCons x $ CCons xs $ CNil
  fields NilAFrame'     [] = Just CNil
  fields (Primitive' _) _  = Just CNil
  fields (Attribute' _) _  = Just CNil
  fields _              _  = Nothing

  apply  :: AFrameFamily t ts -> ts -> t
  apply AFrame'         (CCons prim (CCons attrs (CCons fs CNil)))
                             = AFrame prim attrs fs
  apply ConsAttr'       (CCons (lbl,prop) (CCons xs CNil)) = (lbl,prop) : xs
  apply NilAttr'        CNil = []
  apply ConsAFrame'     (CCons x (CCons xs CNil)) = x : xs
  apply NilAFrame'      CNil = []
  apply (Primitive' p1) CNil = p1
  apply (Attribute' a1) CNil = a1

  string :: AFrameFamily t ts -> String
  string AFrame'         = "AFrame"
  string ConsAttr'       = "ConsAttr"
  string NilAttr'        = "NilAttr"
  string ConsAFrame'     = "ConsAFrame"
  string NilAFrame'      = "NilAFrame"
  string (Primitive' l1) = show l1
  string (Attribute' p1) = show p1


instance Type AFrameFamily AFrame where
    constructors = [Concr AFrame']

instance Type AFrameFamily Primitive where
    constructors = [Abstr Primitive']
    
instance Type AFrameFamily [Attribute] where
    constructors = [Concr ConsAttr',Concr NilAttr']    

instance Type AFrameFamily [AFrame] where
    constructors = [Concr ConsAFrame',Concr NilAFrame']
 
instance Type AFrameFamily Attribute where
    constructors = [Abstr Attribute']

data AFrameUpdate = AFrameUpdate 
    { aframePath     :: Path
    , aframeLabel    :: Label
    , aframeProperty :: Property
    }

{-
    compareAFrame :: AFrame -> AFrame -> Maybe [([Text],Attribute)]
compareAFrame aframe1 aframe2 = fmap (fmap (\ (xs,a) -> (intercalate " > " xs,a))) 
    $ deltaAFrame aframe1 aframe2
-}
deltaAFrame :: AFrame -> AFrame -> Maybe [(Path,Attribute)]
deltaAFrame (AFrame p1@(Primitive primName) attrs1 aframes1)
             (AFrame p2 attrs2 aframes2)
      | p1 /= p2 = fail "element name does not match in deltasAFrame"
      | length aframes1 /= length aframes2
                 = fail "sub elements count do not match in deltasAFrame"          
      | otherwise = do
              attrsD <- fmap (\ a -> (Path p1 [],a)) <$> deltaAttributes attrs1 attrs2
              let ps = [ p | AFrame p _ _ <- aframes1 ]
                  xs = [ length [ () | x' <- xs, x' == x ] | (x:xs) <- tail $ scanl (flip (:)) [] ps ]
              aframesD <- concat <$> sequence
                    [ do ds <- deltaAFrame a1 a2
                         return $ fmap (\ (Path p ps,at) -> (Path p1 ((x,p):ps),at)) ds
                    | (a1,a2,x) <- zip3 aframes1 aframes2 xs
                    ]
              return $ attrsD ++ aframesD

deltaAttributes :: [Attribute] -> [Attribute] -> Maybe [Attribute]
deltaAttributes xs ys | length xs /= length ys = fail "different number of arguments for deltaAttributes"
deltaAttributes xs ys = concat <$> sequence [ deltaAttribute x y | (x,y) <- xs `zip` ys ]
  
deltaAttribute :: Attribute -> Attribute -> Maybe [Attribute]
deltaAttribute attr1@(lbl1,_) attr2@(lbl2,_)
  | attr1 == attr2 = return []       -- same result
  | lbl1 == lbl2   = return [attr2]  -- true update
  | otherwise      = fail "labels do not match in deltaAttributes"

------------------------------------------------------------------------------------------

unpackProperty :: Property -> [(Label,Property)]
unpackProperty (Property prop) = 
      [ (Label (T.dropWhile isSpace l), Property (T.dropWhile (\ c -> isSpace c || c == ':') p))
      | (l,p) <- map (T.span (/= ':')) (T.splitOn ";" prop) 
      , not (T.null p)
      ]

packProperty :: [(Label,Property)] -> Property
packProperty = Property 
             . T.intercalate "; " 
             . map (\ (Label lbl,Property txt) -> lbl <> ": " <> txt)

------------------------------------------------------------------------------------------

preOrderFrame :: Monad m => (AFrame -> m AFrame) -> AFrame -> m AFrame
preOrderFrame f af = do
  AFrame prim attrs aframes <- f af
  aframes' <- traverse (preOrderFrame f) aframes
  return $ AFrame prim attrs aframes'

-- This finds \<script src=\"...\"> and inserts the text=\"..\" into the \<script>.
resolveScript :: Monad m => (Text -> m LT.Text) -> AFrame -> m AFrame
resolveScript rf  = preOrderFrame fn
  where 
    fn af@(AFrame "script" attrs aframes) = case lookup "src" attrs of
      Nothing -> return af
      Just (Property path) ->
            do txt <- rf path
               return $ AFrame "script" 
                         ((Label "text",Property (LT.toStrict txt))
                             : [(l,p) | (l,p) <- attrs, l `notElem` ["src","text"]]
                         )
                         aframes
    fn af = return af
instantiateTemplates :: Monad m => ([Attribute] -> AFrame -> m AFrame) -> AFrame -> m AFrame
instantiateTemplates f root = preOrderFrame fn root
  where
    fn (aEntity@(AFrame "a-entity" attrs aframes)) = case lookup "template" attrs of
          Nothing -> return aEntity
          Just templ -> case lookup "src" (unpackProperty templ) of
            Nothing -> return aEntity
            Just (Property src) | T.take 1 src == "#" -> 
              case getElementById root (T.drop 1 src) of
                Just (script@(AFrame "script" attrs _)) -> do
                    txt <- f attrs script
                    return aEntity
                _ -> return aEntity  -- id not found
    fn af = return af
