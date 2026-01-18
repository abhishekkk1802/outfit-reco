# 👔 Outfit Recommendation System

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Express](https://img.shields.io/badge/Express-5.x-blue.svg)
![Redis](https://img.shields.io/badge/Redis-7+-red.svg)

---

## 📖 Table of Contents

1. [Project Overview](#a-project-overview)
2. [Architecture Explanation](#b-architecture-explanation)
3. [Recommendation Logic](#c-recommendation-logic)
4. [Performance Strategy](#d-performance-strategy)
5. [AI Usage](#e-ai-usage)
6. [How to Run](#f-how-to-run)
7. [Assumptions & Trade-offs](#g-assumptions--trade-offs)

---

## a. Project Overview

### What I Built

I built a **smart outfit recommendation system** that helps users find matching clothes.

**How it works:**
1. User browses a catalog of products (shirts, pants, shoes, etc.)
2. User clicks on any product they like
3. System instantly shows **5 complete outfit combinations** that go well with the selected item

**Example:**
- User clicks on "Nike Sneakers"
- System shows 5 outfits, each containing: Top + Bottom + Accessories that match the sneakers
- Each outfit has a **match score** (like 85%) explaining how good the combination is
- **AI explains** why the outfit works (e.g., "Colors complement each other")

### Key Features

| Feature | What It Does |
|---------|--------------|
| **Smart Matching** | Finds products that look good together based on style, color, and occasion |
| **Multi-Factor Scoring** | Ranks outfits using 5 factors: style (35%), color (25%), occasion (20%), season (10%), budget (10%) |
| **AI Explanations** | Uses Google Gemini to write natural language explanations for each outfit |
| **Instant Responses** | Returns results in under 1 second using Redis caching |
| **Flexible Filters** | Filter by budget, season (winter/summer), and occasion (casual/formal) |

### Tech Stack

| Component | Technology | Why I Chose It |
|-----------|------------|----------------|
| Backend | Node.js + Express 5 | Fast, non-blocking, great for APIs |
| Caching | Redis | In-memory = ultra-fast reads |
| Queue | BullMQ | Reliable job processing built on Redis |
| AI | Google Gemini | Free tier, fast responses, good quality |
| Frontend | Vanilla JS | Simple, no build step, fast loading |

---

## b. Architecture Explanation

### System Design Overview

I designed a **3-tier architecture** with background processing:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TIER 1: PRESENTATION                          │
│                                                                      │
│   Browser (HTML/CSS/JS) ←──── User sees products and outfits        │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ HTTP
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        TIER 2: APPLICATION                           │
│                                                                      │
│   Express Server ←──── Handles API requests                         │
│        │                                                             │
│        ├── GET /products          → Returns product catalog         │
│        └── GET /recommendations   → Generates outfit recommendations│
│                    │                                                 │
│                    ▼                                                 │
│   ┌─────────────────────────────────────────┐                       │
│   │      RECOMMENDATION ENGINE              │                       │
│   │                                         │                       │
│   │  1. Classify products by role           │                       │
│   │  2. Generate combinations               │                       │
│   │  3. Score each outfit                   │                       │
│   │  4. Return top 5                        │                       │
│   └─────────────────────────────────────────┘                       │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        TIER 3: DATA & SERVICES                       │
│                                                                      │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│   │    REDIS     │    │   BULLMQ     │    │       WORKER         │  │
│   │   (Cache)    │    │   (Queue)    │    │   (Background AI)    │  │
│   │              │    │              │    │                      │  │
│   │ Stores:      │    │ Stores:      │    │ Does:                │  │
│   │ • Outfits    │    │ • AI jobs    │    │ • Calls AI API       │  │
│   │ • AI results │    │              │    │ • Saves explanations │  │
│   └──────────────┘    └──────────────┘    └───────────┬──────────┘  │
│                                                       │              │
│                                                       ▼              │
│                              ┌────────────────────────────────────┐  │
│                              │     AI ABSTRACTION LAYER           │  │
│                              │     (Supports multiple providers)  │  │
│                              │                                    │  │
│                              │   .env → gemini   = Google Gemini  │  │
│                              │   .env → openai   = OpenAI GPT     │  │
│                              │   .env → claude   = Anthropic      │  │
│                              │   .env → deepseek = DeepSeek       │  │
│                              └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow (Step by Step)

**When user clicks a product:**

```
Step 1: Browser sends request
        GET /recommendations?base_sku=SKU123&budget=50000&season=winter

Step 2: Server checks Redis cache
        → If found: Return cached result (5ms) ✓ FAST PATH
        → If not found: Continue to Step 3

Step 3: Recommendation Engine generates outfits
        → Find matching tops, bottoms, footwear, accessories
        → Create combinations
        → Score each combination
        → Pick top 5

Step 4: Save to Redis cache (for next time)
        Key: "reco:v2:SKU123:b50000:swinter:..."
        TTL: 20 minutes

Step 5: Queue AI jobs (background, non-blocking)
        → For each outfit, add job: "Explain outfit #123"

Step 6: Return response immediately
        → Outfits with scores (AI pending)
        → Response time: 100-300ms

Step 7: Worker processes AI jobs (background)
        → Calls Gemini API
        → Saves explanation to Redis
        → User sees AI when they refresh
```

### Why This Design?

| Design Decision | Problem Solved |
|-----------------|----------------|
| **Separate Worker** | AI calls take 3-5s. If we wait, user experience is bad. Background processing keeps main server fast. |
| **Redis Cache** | Same outfit query shouldn't be recalculated. Cache saves 95% of work. |
| **BullMQ Queue** | Handles retries if AI fails. Processes jobs reliably even if server restarts. |
| **AI Abstraction** | Can switch from Gemini to OpenAI by changing 1 line in .env. No code changes. |

📚 **For detailed architecture diagrams, see [ARCHITECTURE.md](./ARCHITECTURE.md)**

---

## c. Recommendation Logic

### How I Generate Outfits

My algorithm finds clothes that go well together. Here's how:

#### Step 1: Classify Products by Role

Every product is classified into a role:

```javascript
// If product title/tags contain these words:
TOP      → "shirt", "tshirt", "hoodie", "sweater", "jacket"
BOTTOM   → "jeans", "pants", "trousers", "shorts"  
FOOTWEAR → "sneaker", "shoes", "boots", "slides"
ACCESSORY → "bag", "wallet", "cap", "watch", "sunglasses"
```

**Example:**
- "Nike Air Force 1 Sneakers" → **FOOTWEAR**
- "Blue Denim Jeans" → **BOTTOM**
- "White Cotton T-Shirt" → **TOP**

#### Step 2: Find Similar Products (Smart Sampling)

I use **Jaccard Similarity** to find products that match the base product's style:

```
Jaccard Similarity = Common Tags / Total Unique Tags

Example:
  Base (Nike Sneakers): ["sporty", "casual", "white"]
  Candidate (T-Shirt):  ["sporty", "casual", "summer"]
  
  Common tags: 2 (sporty, casual)
  Unique tags: 4 (sporty, casual, white, summer)
  
  Similarity = 2/4 = 0.50 (50% match)
```

Products with higher similarity are prioritized.

#### Step 3: Generate Combinations

I create outfit combinations by picking one item from each role:

```
For each Top in top_products (max 20):
  For each Bottom in bottom_products (max 20):
    For each Footwear in footwear_products (max 20):
      Pick 1-2 accessories
      Calculate outfit score
      If score > 0.5, consider this outfit
      Stop early when we have enough good outfits
```

#### Step 4: Score Each Outfit

Every outfit gets a **match score from 0 to 100%** based on 5 factors:

| Factor | Weight | What It Measures |
|--------|--------|------------------|
| **Style Match** | 35% | Do the items share similar style tags? (casual, formal, sporty) |
| **Color Harmony** | 25% | Do the colors work together? (neutrals with pops of color) |
| **Occasion Fit** | 20% | Does the outfit match the requested occasion? (casual, party) |
| **Season Fit** | 10% | Does the outfit match the requested season? (winter, summer) |
| **Budget Fit** | 10% | Is the total price within budget? |

**Scoring Formula:**

```javascript
score = (0.35 × styleMatch) 
      + (0.25 × colorHarmony) 
      + (0.20 × occasionFit) 
      + (0.10 × seasonFit) 
      + (0.10 × budgetFit)
```

**Example Calculation:**

```
Outfit: Nike Sneakers + White Tee + Blue Jeans + Silver Watch

Style Match:     0.80 (high tag overlap)      → 0.80 × 0.35 = 0.280
Color Harmony:   0.85 (white, blue, silver)   → 0.85 × 0.25 = 0.212
Occasion Fit:    0.70 (casual requested)      → 0.70 × 0.20 = 0.140
Season Fit:      0.90 (summer compatible)     → 0.90 × 0.10 = 0.090
Budget Fit:      0.75 (within budget)         → 0.75 × 0.10 = 0.075
─────────────────────────────────────────────────────────────────
Total Score:     0.797 → 79.7% match ✓
```

#### Step 5: Ensure Diversity

I use `differsEnough()` to make sure outfits are different:

```javascript
// Each outfit must have at least 3 different items from previous outfits
// This prevents showing 5 outfits with the same jeans
```

#### Step 6: Return Top 5 Outfits

Outfits are sorted by score, and top 5 are returned.

---

## d. Performance Strategy

### How I Achieve Sub-1 Second Response Time

| Technique | How It Works | Impact |
|-----------|--------------|--------|
| **Redis Caching** | Store generated outfits for 20 minutes | Cache hit = 5ms response |
| **Async AI** | AI runs in background worker | No waiting for 3-5s AI calls |
| **Early Termination** | Stop when 5 good outfits found | Don't compute unnecessary combinations |
| **Smart Sampling** | Only consider top 20 products per role | Max 20×20×20 = 8,000 combinations instead of millions |
| **Min-Heap** | Efficient top-N selection | O(log N) insertion instead of sorting |

### Response Time Breakdown

| Scenario | Response Time | Why |
|----------|---------------|-----|
| **Cache HIT** | 5-15ms | Just read from Redis |
| **Cache MISS** | 100-300ms | Generate + score + cache |
| **If AI was sync** | 3-5 seconds | Would have to wait for AI |
| **With async AI** | 100-300ms | AI processed in background |

### What Gets Cached

```
┌──────────────────────────────────────────────────────────────────┐
│                         REDIS CACHE                               │
│                                                                   │
│  OUTFIT RESULTS                                                   │
│  ──────────────                                                   │
│  Key:   reco:v2:{sku}:b{budget}:s{season}:o{occasion}:c{count}   │
│  Value: [outfit1, outfit2, outfit3, outfit4, outfit5]            │
│  TTL:   20 minutes                                                │
│                                                                   │
│  AI EXPLANATIONS                                                  │
│  ────────────────                                                 │
│  Key:   ai:{reco_id}                                             │
│  Value: { "paragraph": "...", "bullets": [...] }                 │
│  TTL:   No expiry (persists until Redis restart)                 │
└──────────────────────────────────────────────────────────────────┘
```

### What Runs Async (Background)

```
┌──────────────────────────────────────────────────────────────────┐
│                    BACKGROUND PROCESSING                          │
│                                                                   │
│  PROBLEM: Gemini AI takes 2-5 seconds per call                   │
│  SOLUTION: Don't make user wait!                                  │
│                                                                   │
│  1. Server generates outfits (fast, 100ms)                       │
│  2. Server adds AI jobs to BullMQ queue                          │
│  3. Server returns response immediately (user sees outfits)      │
│  4. Worker picks up jobs from queue                              │
│  5. Worker calls Gemini AI (2-5s per outfit)                     │
│  6. Worker saves explanation to Redis                            │
│  7. User refreshes → sees AI explanations                        │
│                                                                   │
│  RESULT: User gets outfits in 100ms, AI comes later             │
└──────────────────────────────────────────────────────────────────┘
```

---

## e. AI Usage

### What AI I Used

**Google Gemini API** (gemini-1.5-flash model)

### Why I Chose Gemini

| Reason | Explanation |
|--------|-------------|
| **Free Tier** | 15 requests/minute free, good for development |
| **Fast** | 1-3 second responses |
| **Quality** | Understands fashion context well |
| **Flexible** | Can switch to OpenAI/Claude via abstraction layer |

### What AI Does

AI generates **human-readable explanations** for why an outfit works:

**Input (what I send to AI):**
```
You are a fashion expert. Explain why this outfit works:

Selected Item: Nike Air Force 1 (white sneakers)
Outfit:
- Top: White Cotton T-Shirt
- Bottom: Blue Denim Jeans  
- Accessories: Black Cap, Silver Watch

Return JSON with a paragraph and 3 bullet points.
```

**Output (what AI returns):**
```json
{
  "paragraph": "This casual outfit creates a clean, sporty look by pairing classic white sneakers with a crisp white tee and timeless blue jeans. The black cap adds contrast while the silver watch brings a touch of sophistication.",
  "bullets": [
    "Clean white-on-white creates a fresh, cohesive look",
    "Blue denim grounds the outfit with a classic neutral",
    "Accessories add personality without overwhelming"
  ]
}
```

### AI Abstraction Layer (Flexible Design)

I built an **abstraction layer** so the system can use ANY AI provider:

```
┌──────────────────────────────────────────────────────────────────┐
│                    SAME CODE, DIFFERENT AI                        │
│                                                                   │
│   // In my code, I just call:                                    │
│   const result = await aiProvider.call(prompt);                  │
│                                                                   │
│   // Which AI is used depends on .env:                           │
│   AI_PROVIDER=gemini   → Uses Google Gemini                      │
│   AI_PROVIDER=openai   → Uses OpenAI GPT                         │
│   AI_PROVIDER=claude   → Uses Anthropic Claude                   │
│   AI_PROVIDER=deepseek → Uses DeepSeek                           │
│                                                                   │
│   // No code changes needed to switch!                           │
└──────────────────────────────────────────────────────────────────┘
```

**Why this matters:**
- If Gemini is down → Switch to OpenAI in 10 seconds
- If budget is tight → Switch to cheaper DeepSeek
- If quality matters → Switch to Claude/GPT-4
- Future new AI → Easy to add

---

## f. How to Run

### Prerequisites

- **Node.js 18+** (runtime)
- **Docker** (for Redis)
- **Gemini API Key** (free at https://aistudio.google.com/)

### Step-by-Step Setup

```bash
# 1. Clone and enter directory
git clone <your-repo-url>
cd outfit-reco

# 2. Install dependencies
npm install

# 3. Create .env file
cat > .env << EOF
PORT=3000
REDIS_URL=redis://localhost:6379
AI_PROVIDER=gemini
GEMINI_API_KEY=your_api_key_here
EOF

# 4. Start Redis (using Docker)
docker compose up -d

# 5. Start the API server
npm start
# Output: Server running on http://localhost:3000

# 6. Start the worker (new terminal)
npm run worker
# Output: [Worker] Started - queue: ai-explanations

# 7. Open browser
open http://localhost:3000
```

### Sample API Request

**Get outfit recommendations:**

```bash
curl "http://localhost:3000/recommendations?base_sku=SKU001&budget=50000&season=winter&occasion=casual&count=5"
```

**Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `base_sku` | string | ✅ Yes | Product SKU to build outfit around | SKU001 |
| `budget` | number | No | Maximum total budget (₹) | 50000 |
| `season` | string | No | Season filter | winter, summer |
| `occasion` | string | No | Occasion filter | casual, formal, party |
| `count` | number | No | Number of outfits (1-10) | 5 |

### Sample API Response

```json
{
  "base_sku": "SKU001",
  "cached": false,
  "latency_ms": 145,
  "outfits": [
    {
      "reco_id": "a1b2c3d4",
      "match_score": 0.85,
      "total_price": 25000,
      "top": {
        "sku": "SKU002",
        "title": "White Cotton T-Shirt",
        "brand": "Zara",
        "price": 2500,
        "image": "https://example.com/tshirt.jpg"
      },
      "bottom": {
        "sku": "SKU003",
        "title": "Blue Denim Jeans",
        "brand": "Levi's",
        "price": 5000,
        "image": "https://example.com/jeans.jpg"
      },
      "footwear": {
        "sku": "SKU001",
        "title": "Nike Air Force 1",
        "brand": "Nike",
        "price": 8000,
        "image": "https://example.com/nike.jpg"
      },
      "accessories": [
        {
          "sku": "SKU005",
          "title": "Classic Watch",
          "brand": "Casio",
          "price": 3500
        }
      ],
      "reasoning_fast": [
        "Style match: 0.80 (similar tags)",
        "Color harmony: 0.85 (neutral palette)",
        "Occasion fit: 0.70 (casual match)",
        "Season fit: 0.90 (winter appropriate)",
        "Budget alignment: 0.75 (within budget)"
      ],
      "ai_reasoning_status": "ready",
      "ai_reasoning": {
        "paragraph": "This casual winter outfit combines...",
        "bullets": [
          "Complementary colors",
          "Casual sporty vibe",
          "Weather-appropriate"
        ]
      }
    }
  ]
}
```

### Other API Endpoints

```bash
# Get all products
curl "http://localhost:3000/products"

# Filter products by role
curl "http://localhost:3000/products?role=top"

# Get single product
curl "http://localhost:3000/products/SKU001"
```

---

## g. Assumptions & Trade-offs

### Assumptions I Made

| Assumption | Why |
|------------|-----|
| **Product data is clean** | Excel file has valid SKUs, prices, and image URLs |
| **Images hosted externally** | URLs in Excel point to existing images |
| **One base product per request** | Simpler logic, clear user intent |
| **Price in INR (₹)** | Can be changed by updating frontend |

### What I Simplified

| Simplification | What I Would Do With More Time |
|----------------|-------------------------------|
| **No user accounts** | Add login, save favorites, personalized recommendations |
| **No purchase flow** | Add cart, checkout, payment integration |
| **No inventory check** | Filter out-of-stock items |
| **No size matching** | Use user profile for size recommendations |
| **Fixed scoring weights** | A/B test to optimize weights |

### Trade-offs I Made

| Decision | What I Chose | Alternative | Why I Chose This |
|----------|--------------|-------------|------------------|
| **Response Speed** | Simple scoring algorithm | Complex ML model | Sub-1s requirement; simple is fast |
| **AI Processing** | Async (background) | Sync (blocking) | User shouldn't wait 3-5 seconds |
| **Caching Strategy** | 20 min TTL | Longer/shorter | Balance freshness vs. performance |
| **Scoring Formula** | Weighted average | Neural network | Interpretable, no training data needed |

### What I Would Improve With More Time

1. **Machine Learning Scoring** — Train model on user clicks/purchases to improve recommendations
2. **Image-Based Matching** — Use computer vision to analyze product images for color/style
3. **User Personalization** — Learn user preferences over time
4. **Inventory Integration** — Only show in-stock items
5. **Size Recommendations** — Suggest sizes based on user measurements
6. **Natural Language Search** — "Show me casual winter outfits under 20k"
7. **A/B Testing Framework** — Test different scoring weights
8. **Analytics Dashboard** — Track which recommendations convert best

---

## 📁 Project Structure

```
outfit-reco/
│
├── public/                     # FRONTEND
│   ├── index.html             # Page structure
│   ├── app.js                 # JavaScript logic
│   └── styles.css             # Styling
│
├── src/
│   ├── server.js              # Entry point - starts server
│   ├── app.js                 # Express app configuration
│   ├── worker.js              # Background AI worker
│   │
│   ├── routes/                # API ENDPOINTS
│   │   ├── products.js        # GET /products
│   │   └── recommendations.js # GET /recommendations
│   │
│   ├── reco/                  # RECOMMENDATION ENGINE
│   │   ├── generate.js        # Outfit generation algorithm
│   │   ├── score.js           # Scoring formula
│   │   ├── role.js            # Product classification
│   │   ├── aiProvider.js      # AI abstraction layer
│   │   ├── queue.js           # BullMQ configuration
│   │   └── redis.js           # Redis connection
│   │
│   └── data/
│       └── loadCatalog.js     # Excel product loader
│
├── docker-compose.yml         # Redis container
├── package.json               # Dependencies
└── Sample Products.xlsx       # Product catalog
```

---

Made by **ABHISHEK GANGWAR**
