const express = require("express");
const { redis } = require("../reco/redis");
const { aiQueue } = require("../reco/queue");
const { generateOutfits } = require("../reco/generate");
const { recoCacheKey, aiKey } = require("../reco/cacheKeys");

function recommendationsRouter({ catalog }) {
  const r = express.Router();

  r.get("/", async (req, res) => {
    const start = Date.now();

    const base_sku = String(req.query.base_sku || "").trim();
    if (!base_sku) return res.status(400).json({ error: "base_sku is required" });

    const budget = req.query.budget ? Number(req.query.budget) : null;
    const season = req.query.season ? String(req.query.season) : null;
    const occasion = req.query.occasion ? String(req.query.occasion) : null;
    const count = req.query.count ? Math.max(1, Math.min(10, Number(req.query.count))) : 5;

    const base = catalog.bySku.get(base_sku);
    if (!base) return res.status(404).json({ error: "Base product not found" });

    const key = recoCacheKey({ baseSku: base_sku, budget, season, occasion, count });

    let cached = false;
    let outfits = null;

    const cachedStr = await redis.get(key);
    if (cachedStr) {
      cached = true;
      outfits = JSON.parse(cachedStr);
    } else {
      outfits = generateOutfits({ base, byRole: catalog.byRole, count, budget, season, occasion });
      await redis.set(key, JSON.stringify(outfits), "EX", 60 * 20); // 20 min
    }

    // Enrich with AI explanations or enqueue jobs
    const enriched = [];
    for (const o of outfits) {
      const aikey = aiKey(o.reco_id);
      const ai = await redis.get(aikey);
      if (ai) {
        try {
          const parsedAI = JSON.parse(ai);
          // Validate parsed AI has required structure
          if (parsedAI && (parsedAI.paragraph || parsedAI.bullets)) {
            enriched.push({ ...o, ai_reasoning_status: "ready", ai_reasoning: parsedAI });
          } else {
            console.warn(`[Recommendations] Invalid AI reasoning structure for ${o.reco_id}`);
            enriched.push({ ...o, ai_reasoning_status: "pending", ai_reasoning: null });
          }
        } catch (parseErr) {
          console.error(`[Recommendations] Failed to parse AI reasoning for ${o.reco_id}: ${parseErr.message}`);
          console.error(`[Recommendations] Raw AI data: ${ai.substring(0, 200)}...`);
          // Remove corrupted data and re-queue
          await redis.del(aikey);
          await aiQueue.add("explain", {
            reco_id: o.reco_id,
            base: { sku: base.sku, title: base.title, brand: base.brand, tags: base.tags },
            items: {
              top: { sku: o.top.sku, title: o.top.title, brand: o.top.brand },
              bottom: { sku: o.bottom.sku, title: o.bottom.title, brand: o.bottom.brand },
              footwear: { sku: o.footwear.sku, title: o.footwear.title, brand: o.footwear.brand },
              accessories: o.accessories.map(a => ({ sku: a.sku, title: a.title, brand: a.brand }))
            },
            constraints: { budget, season, occasion }
          }, { jobId: o.reco_id });
          enriched.push({ ...o, ai_reasoning_status: "pending", ai_reasoning: null });
        }
      } else {
        // enqueue without waiting
        await aiQueue.add("explain", {
          reco_id: o.reco_id,
          base: { sku: base.sku, title: base.title, brand: base.brand, tags: base.tags },
          items: {
            top: { sku: o.top.sku, title: o.top.title, brand: o.top.brand },
            bottom: { sku: o.bottom.sku, title: o.bottom.title, brand: o.bottom.brand },
            footwear: { sku: o.footwear.sku, title: o.footwear.title, brand: o.footwear.brand },
            accessories: o.accessories.map(a => ({ sku: a.sku, title: a.title, brand: a.brand }))
          },
          constraints: { budget, season, occasion }
        }, { jobId: o.reco_id }); // idempotent
        enriched.push({ ...o, ai_reasoning_status: "pending", ai_reasoning: null });
      }
    }

    res.json({
      base_sku,
      cached,
      latency_ms: Date.now() - start,
      outfits: enriched
    });
  });

  return r;
}

module.exports = { recommendationsRouter };
