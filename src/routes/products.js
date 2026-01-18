const express = require("express");

function productsRouter({ catalog }) {
  const r = express.Router();

  // Get all products (for product selection page)
  r.get("/", (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : 500;
    const role = req.query.role ? String(req.query.role) : null;
    
    let products = catalog.products;
    
    // Filter by role if specified
    if (role && catalog.byRole.has(role)) {
      products = catalog.byRole.get(role);
      console.log(`[Products API] Filtering by role "${role}": ${products.length} products found`);
    } else if (role) {
      // Role specified but not found in map
      products = [];
      console.log(`[Products API] Role "${role}" not found in catalog`);
    }
    
    // Limit results
    const limited = products.slice(0, limit);
    
    res.json({
      total: products.length,
      count: limited.length,
      products: limited
    });
  });

  r.get("/:sku", (req, res) => {
    const sku = String(req.params.sku);
    const p = catalog.bySku.get(sku);
    if (!p) return res.status(404).json({ error: "Product not found" });
    res.json(p);
  });

  return r;
}

module.exports = { productsRouter };
