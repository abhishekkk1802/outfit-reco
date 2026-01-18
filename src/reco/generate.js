const { scoreOutfit } = require("./score");
const crypto = require("crypto");

// Min-heap for keeping top N outfits efficiently
class MinHeap {
  constructor(maxSize) {
    this.heap = [];
    this.maxSize = maxSize;
  }

  push(outfit) {
    if (this.heap.length < this.maxSize) {
      this.heap.push(outfit);
      this.heapifyUp();
    } else if (outfit.match_score > this.heap[0].match_score) {
      this.heap[0] = outfit;
      this.heapifyDown();
    }
  }

  heapifyUp() {
    let i = this.heap.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].match_score <= this.heap[i].match_score) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  heapifyDown() {
    let i = 0;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < this.heap.length && this.heap[left].match_score < this.heap[smallest].match_score) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right].match_score < this.heap[smallest].match_score) {
        smallest = right;
      }
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
      i = smallest;
    }
  }

  toSortedArray() {
    return this.heap.sort((a, b) => b.match_score - a.match_score);
  }
}

// Pre-filter products by constraints before combinations
function preFilterProducts(products, base, budget, season, occasion) {
  return products.filter(p => {
    if (budget && p.price > budget * 0.5) return false;
    if (season && p.seasons?.length > 0 && !p.seasons.includes(season.toLowerCase())) return false;
    if (occasion && p.occasions?.length > 0 && !p.occasions.includes(occasion.toLowerCase())) return false;
    return true;
  });
}

// Smart sampling: prioritize products similar to base
function sampleProducts(products, count, baseTags = []) {
  if (products.length <= count) return products;
  
  const baseTagSet = new Set(baseTags);
  const scored = products.map(p => ({
    product: p,
    score: jaccardSimilarity(baseTagSet, new Set(p.tags || []))
  }));
  
  scored.sort((a, b) => b.score - a.score);
  const topCount = Math.floor(count * 0.6);
  const randomCount = count - topCount;
  
  const selected = scored.slice(0, topCount).map(s => s.product);
  const remaining = scored.slice(topCount);
  
  for (let i = 0; i < randomCount && remaining.length > 0; i++) {
    const randomIdx = Math.floor(Math.random() * remaining.length);
    selected.push(remaining[randomIdx].product);
    remaining.splice(randomIdx, 1);
  }
  
  return selected;
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0.5;
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function recoId(baseSku, top, bottom, footwear, accessories) {
  const acc = (accessories || []).map(a => a.sku).sort().join(",");
  const s = `${baseSku}|${top.sku}|${bottom.sku}|${footwear.sku}|${acc}`;
  return crypto.createHash("sha1").update(s).digest("hex");
}

function differsEnough(existing, cand) {
  const set = new Set([
    existing.top.sku, existing.bottom.sku, existing.footwear.sku,
    ...(existing.accessories || []).map(x => x.sku)
  ]);
  const arr = [
    cand.top.sku, cand.bottom.sku, cand.footwear.sku,
    ...(cand.accessories || []).map(x => x.sku)
  ];
  let same = 0;
  for (const x of arr) if (set.has(x)) same++;
  // Require at least 3 items to differ (Very Strict - Option 2)
  return same <= Math.max(0, arr.length - 3);
}

function generateOutfits({ base, byRole, count=5, budget, season, occasion }) {
  const gender = base.gender || "";
  const genderOk = (p) => !gender || !p.gender || p.gender === gender;
  const notBase = (p) => p.sku && p.sku !== base.sku;

  // Pre-filter products by constraints BEFORE creating combinations
  const allTops = (byRole.get("top") || []).filter(p => genderOk(p) && notBase(p));
  const allBottoms = (byRole.get("bottom") || []).filter(p => genderOk(p) && notBase(p));
  const allFootwear = (byRole.get("footwear") || []).filter(p => genderOk(p) && notBase(p));
  const allAcc = (byRole.get("accessory") || []).filter(p => genderOk(p) && notBase(p));
  const allOther = (byRole.get("other") || []).filter(p => genderOk(p) && notBase(p));

  // Pre-filter by constraints (budget, season, occasion)
  const filteredTops = preFilterProducts(allTops, base, budget, season, occasion);
  const filteredBottoms = preFilterProducts(allBottoms, base, budget, season, occasion);
  const filteredFootwear = preFilterProducts(allFootwear, base, budget, season, occasion);
  const filteredAcc = preFilterProducts(allAcc, base, budget, season, occasion);
  const filteredOther = preFilterProducts(allOther, base, budget, season, occasion);

  // Smart sampling: prioritize similar products, add variety
  const topList = sampleProducts(filteredTops, 20, base.tags || []);
  const bottomList = sampleProducts(filteredBottoms, 20, base.tags || []);
  const footwearList = sampleProducts(filteredFootwear, 20, base.tags || []);
  const accList = sampleProducts(filteredAcc, 30, base.tags || []);
  const otherList = sampleProducts(filteredOther, 30, base.tags || []);

  // Determine which role the base product belongs to
  const baseRole = base.role || "other";
  
  // Use base product for its role, or iterate through the list for other roles
  const getTopList = () => baseRole === "top" ? [base] : topList;
  const getBottomList = () => baseRole === "bottom" ? [base] : bottomList;
  const getFootwearList = () => baseRole === "footwear" ? [base] : footwearList;

  // Use priority queue instead of array + sort
  const outfitHeap = new MinHeap(count * 3); // Keep 3x candidates for variety
  const seen = new Set();
  const maxIterations = Math.min(topList.length * bottomList.length * footwearList.length, 5000);
  let iterations = 0;

  const tops = getTopList();
  const bottoms = getBottomList();
  const footwears = getFootwearList();

  for (let i=0; i<tops.length && iterations < maxIterations; i++) {
    for (let j=0; j<bottoms.length && iterations < maxIterations; j++) {
      for (let k=0; k<footwears.length && iterations < maxIterations; k++) {
        iterations++;
        
        // Early termination: if we have enough high-scoring outfits, stop
        if (outfitHeap.heap.length >= count * 2) {
          const minScore = outfitHeap.heap[0]?.match_score || 0;
          if (minScore > 0.7) break; // Stop if worst outfit is already good
        }

        const top = tops[i];
        const bottom = bottoms[j];
        const footwear = footwears[k];

        if (baseRole !== "top" && top.sku === base.sku) continue;
        if (baseRole !== "bottom" && bottom.sku === base.sku) continue;
        if (baseRole !== "footwear" && footwear.sku === base.sku) continue;

        // Quick price check before expensive scoring
        const quickTotal = (top.price || 0) + (bottom.price || 0) + (footwear.price || 0);
        if (budget && quickTotal > budget * 0.8) continue;

        // Pick accessories more efficiently
        const accessories = [];
        const usedSkus = new Set([top.sku, bottom.sku, footwear.sku, base.sku]);
        
        for (const cand of accList) {
          if (usedSkus.has(cand.sku)) continue;
          accessories.push(cand);
          usedSkus.add(cand.sku);
          break;
        }
        
        for (const cand of otherList) {
          if (usedSkus.has(cand.sku)) continue;
          accessories.push(cand);
          usedSkus.add(cand.sku);
          break;
        }
        
        if (accessories.length < 2) continue;

        // Final budget check
        const total = quickTotal + accessories.reduce((s, a) => s + (a.price || 0), 0);
        if (budget && total > budget) continue;

        const { score, reasons } = scoreOutfit({ base, top, bottom, footwear, accessories, budget, season, occasion });
        
        // Skip low-scoring outfits early
        if (score < 0.3) continue;

        const id = recoId(base.sku, top, bottom, footwear, accessories);
        if (seen.has(id)) continue;

        const outfit = { reco_id: id, top, bottom, footwear, accessories, match_score: score, total_price: total, reasoning_fast: reasons };
        
        // Check distinctness only against top candidates (not all)
        let isDistinct = true;
        const topCandidates = outfitHeap.toSortedArray().slice(0, 5);
        for (const existing of topCandidates) {
          if (!differsEnough(existing, outfit)) {
            isDistinct = false;
            break;
          }
        }
        if (!isDistinct) continue;

        seen.add(id);
        outfitHeap.push(outfit);
      }
    }
  }

  // Return top N from heap (already sorted)
  return outfitHeap.toSortedArray().slice(0, count);
}

module.exports = { generateOutfits };
