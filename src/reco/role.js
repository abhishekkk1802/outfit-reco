const TOP = ["tshirt","t-shirt","tee","shirt","hoodie","sweatshirt","jacket","coat","sweater","top","polo"];
const BOTTOM = ["jeans","pants","pant","trouser","trousers","cargo","cargos","shorts"];
const FOOTWEAR = ["sneaker","sneakers","shoe","shoes","slide","slides","boot","boots"];
const ACCESSORY = ["bag","wallet","cap","hat","sunglasses","watch","ring","bracelet","necklace","keychain","belt","socks"];
const OUTERWEAR = ["vest","jacket","coat","blazer","cardigan","parka","windbreaker","bomber"];

function hasAny(set, list) {
  for (const w of list) if (set.has(w)) return true;
  return false;
}

function inferRole(p) {
  const set = new Set([...(p.tokens || []), ...(p.tags || [])]);
  
  // Check for outerwear first (vest, jacket, etc.) - these should be "other" not "bottom"
  if (hasAny(set, OUTERWEAR)) return "other";
  
  // Check footwear
  if (hasAny(set, FOOTWEAR)) return "footwear";
  
  // Check bottom - but exclude if it's a vest/jacket (cargo vest, cargo jacket, etc.)
  if (hasAny(set, BOTTOM)) {
    // If it contains "vest" or "jacket", it's outerwear, not bottom
    if (!set.has("vest") && !set.has("jacket") && !set.has("coat")) {
      return "bottom";
    }
  }
  
  if (hasAny(set, TOP)) return "top";
  if (hasAny(set, ACCESSORY)) return "accessory";

  const cat = `${p.category} ${p.subCategory} ${p.productType}`.toLowerCase();
  const title = (p.title || "").toLowerCase();
  
  // Check category patterns
  if (/shoe|sneaker|slide|boot|footwear/.test(cat)) return "footwear";
  
  // Check for outerwear in title/category before checking for pants
  if (/vest|jacket|coat|blazer|outerwear/.test(title) || /vest|jacket|coat|blazer|outerwear/.test(cat)) {
    return "other";
  }
  
  if (/jean|pant|trouser|cargo|short/.test(cat)) {
    // Double-check: if title contains "vest" or "jacket", it's not bottom
    if (!/vest|jacket|coat/.test(title)) {
      return "bottom";
    }
  }
  
  if (/tee|shirt|hoodie|sweatshirt|jacket|sweater|polo/.test(cat)) return "top";
  if (/bag|wallet|cap|watch|sunglass|accessor|sock|belt/.test(cat)) return "accessory";
  return "other";
}

module.exports = { inferRole };
