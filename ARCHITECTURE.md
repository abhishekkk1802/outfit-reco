# 🏗️ System Architecture - Deep Dive

This document provides a detailed technical explanation of the Outfit Recommendation System architecture.

---

## 📖 Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Component Details](#2-component-details)
3. [Data Flow](#3-data-flow)
4. [Performance Optimizations](#4-performance-optimizations)
5. [AI Abstraction Layer](#5-ai-abstraction-layer)
6. [Code Structure](#6-code-structure)

---

## 1. Architecture Overview

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                         BROWSER                                  │   │
│   │                                                                  │   │
│   │   index.html  ─────►  Product Catalog UI                        │   │
│   │   app.js      ─────►  Fetch + Display Logic                     │   │
│   │   styles.css  ─────►  Styling                                   │   │
│   └──────────────────────────────┬──────────────────────────────────┘   │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │ HTTP Requests
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              SERVER LAYER                                │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     EXPRESS.JS SERVER                            │   │
│   │                                                                  │   │
│   │   server.js   ─────►  HTTP Server (port 3000)                   │   │
│   │   app.js      ─────►  Middleware + Routes                       │   │
│   │                                                                  │   │
│   │   ROUTES:                                                        │   │
│   │   ├── GET /products           → Product catalog                 │   │
│   │   ├── GET /products/:sku      → Single product                  │   │
│   │   └── GET /recommendations    → Outfit recommendations          │   │
│   └──────────────────────────────┬──────────────────────────────────┘   │
│                                  │                                       │
│   ┌──────────────────────────────┴──────────────────────────────────┐   │
│   │                   RECOMMENDATION ENGINE                          │   │
│   │                                                                  │   │
│   │   generate.js  ─────►  Create outfit combinations               │   │
│   │   score.js     ─────►  Calculate match scores                   │   │
│   │   role.js      ─────►  Classify products (top/bottom/etc)       │   │
│   │   extract.js   ─────►  Extract features (colors, seasons)       │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────────┐
│      REDIS       │    │     BULLMQ       │    │        WORKER            │
│                  │    │                  │    │                          │
│  ┌────────────┐  │    │  ┌────────────┐  │    │   worker.js              │
│  │   CACHE    │  │    │  │   QUEUE    │  │    │                          │
│  │            │  │    │  │            │  │    │   ┌───────────────────┐  │
│  │ • Outfits  │  │    │  │ • AI jobs  │  │    │   │ AI ABSTRACTION    │  │
│  │ • AI texts │  │    │  │ • Retries  │  │    │   │     LAYER         │  │
│  └────────────┘  │    │  └────────────┘  │    │   │                   │  │
└──────────────────┘    └──────────────────┘    │   │ aiProvider.js     │  │
                                                │   │                   │  │
                                                │   │ ┌───────────────┐ │  │
                                                │   │ │ .env config   │ │  │
                                                │   │ └───────┬───────┘ │  │
                                                │   └─────────┼─────────┘  │
                                                └─────────────┼────────────┘
                                                              │
                              ┌────────────────┬──────────────┼──────────────┬────────────────┐
                              ▼                ▼              ▼              ▼                ▼
                        ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
                        │  GEMINI  │    │  OPENAI  │    │  CLAUDE  │    │ DEEPSEEK │    │  CUSTOM  │
                        │ (Google) │    │  (GPT)   │    │(Anthropic│    │          │    │          │
                        └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### Design Principles

| Principle | How It's Applied |
|-----------|------------------|
| **Separation of Concerns** | Each component has one job (server handles HTTP, engine generates outfits, worker handles AI) |
| **Caching First** | Always check cache before computing |
| **Async for Slow Operations** | AI calls happen in background, don't block user |
| **Abstraction** | AI provider can be swapped via config, not code |
| **Stateless Server** | All state stored in Redis, server can be scaled horizontally |

---

## 2. Component Details

### 2.1 Frontend (Browser)

**Files:** `public/index.html`, `public/app.js`, `public/styles.css`

**Responsibilities:**
- Display product catalog
- Handle user interactions (clicks, filters)
- Fetch data from API
- Display outfit recommendations

**Key Functions:**
```javascript
// app.js
fetchProducts()       // Load all products from API
displayProducts()     // Render product grid
getRecommendations()  // Fetch outfit recommendations
displayOutfits()      // Render recommendation cards
```

### 2.2 Express Server

**Files:** `src/server.js`, `src/app.js`

**Responsibilities:**
- Listen for HTTP requests
- Route to appropriate handlers
- Serve static files (frontend)
- Return JSON responses

**Routes:**
```
GET  /products          → List all products
GET  /products/:sku     → Get single product
GET  /recommendations   → Get outfit recommendations
GET  /                  → Serve frontend
```

### 2.3 Recommendation Engine

**Files:** `src/reco/generate.js`, `src/reco/score.js`, `src/reco/role.js`

**Responsibilities:**
- Classify products by role
- Generate outfit combinations
- Score each outfit
- Filter and sort results

**Algorithm:**
```
Input: base_sku, budget, season, occasion, count

1. Load base product
2. Get all products grouped by role
3. Sample top candidates using Jaccard similarity
4. Generate combinations (top × bottom × footwear × accessories)
5. Score each combination using weighted formula
6. Filter by budget/season/occasion
7. Ensure diversity (differ by 3+ items)
8. Return top N outfits
```

### 2.4 Redis Cache

**Purpose:** Store computed results to avoid recalculation

**Cache Keys:**
```
reco:v2:{sku}:b{budget}:s{season}:o{occasion}:c{count}
  → Stores outfit arrays
  → TTL: 20 minutes

ai:{reco_id}
  → Stores AI explanations
  → TTL: None (persistent)
```

**Why Redis?**
- In-memory = microsecond reads
- Supports TTL for automatic expiry
- Used by BullMQ for queues too
- Simple key-value model

### 2.5 BullMQ Queue

**Purpose:** Reliable background job processing

**Queue:** `ai-explanations`

**Job Structure:**
```javascript
{
  name: "explain-outfit",
  data: {
    reco_id: "abc123",
    items: ["Nike Sneakers", "White Tee", ...],
    occasion: "casual",
    season: "winter"
  }
}
```

**Why BullMQ?**
- Built on Redis (no extra DB)
- Automatic retries on failure
- Job progress tracking
- Multiple workers can share queue

### 2.6 Worker

**File:** `src/worker.js`

**Responsibilities:**
- Pick jobs from BullMQ queue
- Call AI API via abstraction layer
- Parse AI response
- Store result in Redis

**Process:**
```
while (true):
  job = await queue.getNextJob()
  prompt = buildPrompt(job.data)
  response = await aiProvider.call(prompt)
  parsed = aiProvider.parseResponse(response)
  await redis.set(`ai:${job.data.reco_id}`, JSON.stringify(parsed))
  job.markComplete()
```

---

## 3. Data Flow

### Request Flow (User Clicks Product)

```
┌────────────────────────────────────────────────────────────────────────┐
│                         REQUEST FLOW                                    │
└────────────────────────────────────────────────────────────────────────┘

[1] USER clicks "Nike Sneakers"
        │
        ▼
[2] BROWSER sends: GET /recommendations?base_sku=NIKE123&budget=50000
        │
        ▼
[3] SERVER receives request
        │
        ├───► [4] Check REDIS cache
        │           │
        │           ├── HIT → Skip to [8] (return cached)
        │           │
        │           └── MISS → Continue to [5]
        │
        ▼
[5] RECOMMENDATION ENGINE generates outfits
        │
        │   • Find matching products by role
        │   • Generate combinations
        │   • Score each outfit (0-100%)
        │   • Pick top 5
        │
        ▼
[6] Save to REDIS cache (TTL: 20 min)
        │
        ▼
[7] Add AI jobs to BULLMQ queue (for each outfit)
        │
        ▼
[8] Return JSON response to browser
        │
        │   latency: ~100-300ms (cache miss)
        │   latency: ~5-15ms (cache hit)
        │
        ▼
[9] BROWSER displays outfits

┌────────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND (async)                                   │
└────────────────────────────────────────────────────────────────────────┘

[10] WORKER picks job from queue
         │
         ▼
[11] WORKER calls AI (via abstraction layer)
         │
         │   • Build prompt with outfit details
         │   • Call Gemini/OpenAI/Claude API
         │   • Parse JSON response
         │
         ▼
[12] WORKER saves AI explanation to REDIS
         │
         ▼
[13] Next time user requests → AI explanation is "ready"
```

### Sequence Diagram

```
Browser         Server          Redis           Queue           Worker          AI API
   │               │               │               │               │               │
   │  GET /reco    │               │               │               │               │
   │──────────────►│               │               │               │               │
   │               │  GET cache    │               │               │               │
   │               │──────────────►│               │               │               │
   │               │     MISS      │               │               │               │
   │               │◄──────────────│               │               │               │
   │               │               │               │               │               │
   │               │  [Generate]   │               │               │               │
   │               │  [Score]      │               │               │               │
   │               │               │               │               │               │
   │               │  SET cache    │               │               │               │
   │               │──────────────►│               │               │               │
   │               │               │               │               │               │
   │               │  ADD jobs     │               │               │               │
   │               │──────────────────────────────►│               │               │
   │               │               │               │               │               │
   │    Response   │               │               │               │               │
   │◄──────────────│               │               │               │               │
   │               │               │               │  GET job      │               │
   │               │               │               │◄──────────────│               │
   │               │               │               │               │               │
   │               │               │               │               │  API call     │
   │               │               │               │               │──────────────►│
   │               │               │               │               │               │
   │               │               │               │               │   Response    │
   │               │               │               │               │◄──────────────│
   │               │               │               │               │               │
   │               │               │  SET ai:xxx   │               │               │
   │               │               │◄──────────────────────────────│               │
   │               │               │               │               │               │
```

---

## 4. Performance Optimizations

### 4.1 Caching Strategy

```
┌────────────────────────────────────────────────────────────────────┐
│                      CACHING STRATEGY                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LEVEL 1: Outfit Cache                                             │
│  ─────────────────────                                             │
│  Key: reco:v2:{sku}:b{budget}:s{season}:o{occasion}:c{count}      │
│  TTL: 20 minutes                                                   │
│  Hit Rate: ~80% (same product with same filters)                   │
│                                                                     │
│  LEVEL 2: AI Explanation Cache                                     │
│  ────────────────────────────                                      │
│  Key: ai:{reco_id}                                                 │
│  TTL: Infinite (until Redis restart)                               │
│  Hit Rate: ~95% (AI rarely changes for same outfit)                │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 Early Termination

```javascript
// In generate.js
for (const top of tops) {
  for (const bottom of bottoms) {
    for (const footwear of footwears) {
      // ... create outfit, score it
      
      if (results.length >= count && allScoresHigh) {
        return results;  // STOP EARLY - don't compute more
      }
    }
  }
}
```

**Impact:** Reduces computation by 60%+ on average

### 4.3 Smart Sampling

```javascript
// Instead of considering ALL products:
const candidates = products
  .map(p => ({ product: p, similarity: jaccard(baseTags, p.tags) }))
  .sort((a, b) => b.similarity - a.similarity)
  .slice(0, MAX_CANDIDATES);  // Only consider top 20
```

**Impact:** Max 20×20×20 = 8,000 combinations instead of N³

### 4.4 Min-Heap for Top-N

```javascript
// Instead of sorting all outfits:
class MinHeap {
  insert(outfit) {
    // O(log N) insertion
    // Automatically maintains top N highest scores
  }
}
```

**Impact:** O(N log K) instead of O(N log N) where K = count

### 4.5 Async AI Processing

```
WITHOUT async:
  User Request → Generate (100ms) → AI Call (3000ms) → Response
  Total: 3100ms ❌

WITH async:
  User Request → Generate (100ms) → Queue AI → Response
  Total: 100ms ✓
  
  AI processes in background, user sees it on next refresh
```

---

## 5. AI Abstraction Layer

### Why Abstraction?

The AI Abstraction Layer (`src/reco/aiProvider.js`) allows switching AI providers without code changes.

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ABSTRACTION LAYER                                 │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                      aiProvider.js                                │  │
│   │                                                                   │  │
│   │   // Single interface for all providers                          │  │
│   │   async function call(prompt, config) {                          │  │
│   │     const provider = process.env.AI_PROVIDER || 'gemini';        │  │
│   │                                                                   │  │
│   │     switch (provider) {                                          │  │
│   │       case 'gemini':  return callGemini(prompt, config);         │  │
│   │       case 'openai':  return callOpenAI(prompt, config);         │  │
│   │       case 'claude':  return callClaude(prompt, config);         │  │
│   │       case 'deepseek': return callDeepSeek(prompt, config);      │  │
│   │     }                                                            │  │
│   │   }                                                              │  │
│   │                                                                   │  │
│   │   function parseResponse(text) {                                 │  │
│   │     // Unified JSON parsing for all providers                    │  │
│   │     return { paragraph: "...", bullets: [...] };                 │  │
│   │   }                                                              │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Switching Providers

**To switch from Gemini to OpenAI:**

```bash
# .env file - just change one line:

# Before
AI_PROVIDER=gemini
GEMINI_API_KEY=xxx

# After
AI_PROVIDER=openai
OPENAI_API_KEY=yyy
```

**Then restart the worker:**
```bash
npm run worker
```

**No code changes needed!**

### Supported Providers

| Provider | .env Value | API Key Variable | Default Model |
|----------|------------|------------------|---------------|
| Google Gemini | `gemini` | `GEMINI_API_KEY` | gemini-1.5-flash |
| OpenAI | `openai` | `OPENAI_API_KEY` | gpt-4o-mini |
| Anthropic Claude | `claude` | `CLAUDE_API_KEY` | claude-3-haiku |
| DeepSeek | `deepseek` | `DEEPSEEK_API_KEY` | deepseek-chat |

### Benefits of Abstraction

| Benefit | Explanation |
|---------|-------------|
| **Flexibility** | Switch providers in 10 seconds |
| **Resilience** | If one API is down, use another |
| **Cost Optimization** | Use cheaper providers for dev, premium for prod |
| **A/B Testing** | Compare quality between providers |
| **Future-Proof** | Easy to add new AI models |

---

## 6. Code Structure

### Directory Layout

```
outfit-reco/
│
├── public/                       # FRONTEND (Static files)
│   ├── index.html               # HTML structure
│   ├── app.js                   # Client-side JavaScript
│   └── styles.css               # CSS styling
│
├── src/                          # BACKEND (Server code)
│   │
│   ├── server.js                # Entry point - starts HTTP server
│   ├── app.js                   # Express app configuration
│   ├── worker.js                # Background worker for AI jobs
│   │
│   ├── routes/                  # API ROUTE HANDLERS
│   │   ├── products.js          # GET /products, GET /products/:sku
│   │   └── recommendations.js   # GET /recommendations
│   │
│   ├── reco/                    # RECOMMENDATION ENGINE
│   │   ├── generate.js          # Main algorithm - generates outfits
│   │   ├── score.js             # Scoring formula (5 factors)
│   │   ├── role.js              # Classifies products by role
│   │   ├── extract.js           # Extracts colors, seasons, occasions
│   │   ├── tokenize.js          # Breaks text into words
│   │   ├── parseTags.js         # Parses product tags
│   │   │
│   │   ├── aiProvider.js        # ⭐ AI ABSTRACTION LAYER
│   │   ├── queue.js             # BullMQ queue configuration
│   │   ├── redis.js             # Redis connection
│   │   └── cacheKeys.js         # Cache key generators
│   │
│   └── data/
│       └── loadCatalog.js       # Loads products from Excel
│
├── docker-compose.yml           # Redis container definition
├── package.json                 # Node.js dependencies
├── .env                         # Environment variables (not in git)
├── .env.example                 # Example env file
└── Sample Products.xlsx         # Product catalog data
```

### Key Files Explained

| File | Purpose | Key Functions |
|------|---------|---------------|
| `server.js` | Start server | `app.listen()` |
| `app.js` | Configure Express | Middleware, routes |
| `worker.js` | Process AI jobs | BullMQ worker loop |
| `generate.js` | Create outfits | `generateOutfits()` |
| `score.js` | Calculate scores | `scoreOutfit()` |
| `role.js` | Classify products | `inferRole()` |
| `aiProvider.js` | AI abstraction | `call()`, `parseResponse()` |
| `recommendations.js` | API endpoint | `GET /recommendations` |

---

## Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | HTML/CSS/JS | User interface |
| API Server | Express.js | Handle HTTP requests |
| Recommendation Engine | Custom algorithm | Generate & score outfits |
| Cache | Redis | Store computed results |
| Queue | BullMQ | Background job processing |
| Worker | Node.js process | Call AI APIs |
| AI Abstraction | Custom module | Provider-agnostic AI calls |
| AI Providers | Gemini/OpenAI/Claude | Generate explanations |

---

Made by **ABHISHEK GANGWAR**
