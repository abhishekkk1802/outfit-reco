function budgetBucket(budget) {
    if (!budget || !Number.isFinite(budget)) return "na";
    return Math.round(budget / 500) * 500;
  }
  
  function recoCacheKey({ baseSku, budget, season, occasion, count }) {
    return `reco:v2:${baseSku}:b${budgetBucket(budget)}:s${season || "na"}:o${occasion || "na"}:c${count || 5}`;
  }
  
  function aiKey(recoId) {
    return `ai:v2:${recoId}`;
  }
  
  module.exports = { recoCacheKey, aiKey };
  