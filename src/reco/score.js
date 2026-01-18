function jaccard(a, b) {
    const A = new Set(a || []);
    const B = new Set(b || []);
    if (A.size === 0 && B.size === 0) return 0;
    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;
    const union = A.size + B.size - inter;
    return union === 0 ? 0 : inter / union;
  }
  
  function colorHarmony(items) {
    const neutrals = new Set(["black","white","grey","gray","cream","beige","tan","brown"]);
    const colors = [...new Set(items.flatMap(p => p.colors || []))];
    if (colors.length === 0) return 0.6;
    if (colors.length === 1) return 0.9;
    const nonNeutral = colors.filter(c => !neutrals.has(c));
    if (nonNeutral.length <= 1) return 0.85;
    if (nonNeutral.length === 2) return 0.65;
    return 0.45;
  }
  
  function fitByTag(items, want, field) {
    if (!want) return 0.6;
    const w = String(want).toLowerCase();
    const hits = items.filter(p => (p[field] || []).includes(w)).length;
    return Math.min(1, 0.4 + hits / Math.max(1, items.length));
  }
  
  function budgetAlignment(total, budget) {
    if (!budget) return 0.6;
    if (total > budget) return 0.0;
    const ratio = total / budget;
    return 0.5 + 0.5 * ratio;
  }
  
  function styleMatch(base, items) {
    const sims = items.map(p => jaccard(base.tags, p.tags));
    const avg = sims.reduce((a,b) => a+b, 0) / Math.max(1, sims.length);
    return avg;
  }
  
  function scoreOutfit({ base, top, bottom, footwear, accessories, budget, season, occasion }) {
    const items = [top, bottom, footwear, ...(accessories || [])].filter(Boolean);
    const total = items.reduce((s,p) => s + (p.price || 0), 0);
  
    const sStyle = styleMatch(base, items);
    const sColor = colorHarmony(items);
    const sOcc = fitByTag(items, occasion, "occasions");
    const sSeason = fitByTag(items, season, "seasons");
    const sBudget = budgetAlignment(total, budget);
  
    const score =
      0.35 * sStyle +
      0.25 * sColor +
      0.20 * sOcc +
      0.10 * sSeason +
      0.10 * sBudget;
  
    const reasons = [
      `Style match ${sStyle.toFixed(2)} (tag overlap)`,
      `Color harmony ${sColor.toFixed(2)} (neutral/loud rule)`,
      `Occasion fit ${sOcc.toFixed(2)} (${occasion || "not specified"})`,
      `Season fit ${sSeason.toFixed(2)} (${season || "not specified"})`,
      `Budget alignment ${sBudget.toFixed(2)} (total ${total}${budget ? ` / ${budget}` : ""})`
    ];
  
    return { score: Math.max(0, Math.min(1, score)), total, reasons };
  }
  
  module.exports = { scoreOutfit };
  