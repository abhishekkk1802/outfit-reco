require("dotenv").config();
const { Worker } = require("bullmq");
const { redis } = require("./reco/redis");
const { aiKey } = require("./reco/cacheKeys");
const { connection } = require("./reco/queue");
const { callAI, getProvider } = require("./reco/aiProvider");

// Get configured provider info
const provider = getProvider();
const providerName = provider.name;

function buildPrompt(job) {
  const { base, items, constraints } = job;

  return `
You are a fashion stylist.

Base item:
- ${base.title} (${base.brand || "brand n/a"}) tags: ${Array.isArray(base.tags) ? base.tags.join(", ") : ""}

Outfit:
- Top: ${items.top.title} (${items.top.brand || "n/a"})
- Bottom: ${items.bottom.title} (${items.bottom.brand || "n/a"})
- Footwear: ${items.footwear.title} (${items.footwear.brand || "n/a"})
- Accessories: ${items.accessories.map(a => a.title).join(", ")}

Constraints:
- Budget: ${constraints.budget ?? "not specified"}
- Occasion: ${constraints.occasion ?? "not specified"}
- Season: ${constraints.season ?? "not specified"}

Write:
1) One short paragraph (<= 70 words) explaining why this outfit works.
2) 3 bullets labeled Style, Color, Occasion/Season.
Return JSON with keys: paragraph, bullets (array of strings).
`.trim();
}

// This function is now handled by the AI provider abstraction
// Kept for backward compatibility, but now uses the provider system
async function callAIProvider(prompt) {
  return await callAI(prompt);
}

const worker = new Worker(
  "ai-explanations",
  async (job) => {
    const startTime = Date.now();
    const payload = job.data;
    
    try {
      const prompt = buildPrompt(payload);
      let result;
      try {
        result = await callAIProvider(prompt);
      } catch (aiError) {
        // If it's an incomplete JSON error, don't store anything - let it retry
        if (aiError.message.includes("Incomplete JSON") || aiError.message.includes("Failed to parse")) {
          console.error(`[Worker] Incomplete response, will retry: ${job.id}`);
          throw aiError; // Re-throw to trigger BullMQ retry
        }
        throw aiError; // Re-throw other errors
      }

      // Validate result before storing - reject incomplete responses
      if (!result.paragraph || result.paragraph.trim().length === 0) {
        throw new Error("AI response has no paragraph content");
      }
      
      // Check if paragraph looks like incomplete JSON (starts with { or [)
      const paraTrim = result.paragraph.trim();
      if (paraTrim.startsWith("{") || paraTrim.startsWith("[")) {
        throw new Error("AI response paragraph contains incomplete JSON");
      }
      
      // Check if paragraph is suspiciously short (less than 20 chars is likely incomplete)
      if (result.paragraph.length < 20) {
        throw new Error("AI response paragraph is too short, likely incomplete");
      }
      
      if (!Array.isArray(result.bullets)) {
        result.bullets = [];
      }

      // Ensure result is valid JSON before stringifying
      const resultToStore = {
        paragraph: String(result.paragraph || "").trim(),
        bullets: Array.isArray(result.bullets) ? result.bullets.map(b => String(b).trim()) : []
      };

      // Validate JSON can be stringified and parsed
      let jsonString;
      try {
        jsonString = JSON.stringify(resultToStore);
        JSON.parse(jsonString);
      } catch (jsonErr) {
        console.error(`[Worker] JSON validation failed: ${jsonErr.message}`);
        throw new Error(`Invalid JSON structure: ${jsonErr.message}`);
      }

      const cacheKey = aiKey(payload.reco_id);
      await redis.set(cacheKey, jsonString, "EX", 60 * 60 * 24 * 3); // 3 days

      const duration = Date.now() - startTime;
      console.log(`[Worker] ✓ Job ${job.id} completed in ${duration}ms`);

      return { ok: true, reco_id: payload.reco_id, duration_ms: duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Worker] ✗ Job ${job.id} failed after ${duration}ms: ${error.message}`);
      throw error;
    }
  },
  { connection }
);


console.log(`[Worker] Started - queue: ai-explanations, provider: ${providerName}`);
