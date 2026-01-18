const xlsx = require("xlsx");
const path = require("path");
const { normalizeProduct } = require("../reco/extract");
const { inferRole } = require("../reco/role");

/**
 * Loads and processes a product catalog from an Excel file.
 * Normalizes product data, infers clothing roles, and organizes products
 * by SKU and role for efficient lookup.
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.filePath - Path to the Excel file containing product data
 * @returns {Object} Object containing:
 *   - products: Array of all normalized products
 *   - bySku: Map of SKU -> product for quick lookup
 *   - byRole: Map of role -> array of products (top, bottom, footwear, accessory, other)
 */
function loadCatalog({ filePath }) {
  // Resolve the file path to an absolute path
  const abs = path.resolve(filePath);
  
  // Read the Excel workbook from the file
  const wb = xlsx.readFile(abs);
  
  // Get the first sheet in the workbook
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  
  // Convert the sheet to an array of JSON objects (one per row)
  // defval: "" ensures empty cells are set to empty strings instead of undefined
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  // Initialize data structures for organizing products
  const products = []; // Array to hold all products
  const bySku = new Map(); // Map for O(1) lookup by SKU
  const byRole = new Map([
    ["top", []],        // Clothing items worn on upper body
    ["bottom", []],     // Clothing items worn on lower body
    ["footwear", []],   // Shoes and similar items
    ["accessory", []],  // Accessories like bags, jewelry, etc.
    ["other", []]       // Items that don't fit other categories
  ]);

  // Process each row from the Excel sheet
  for (const r of rows) {
    // Normalize the raw product data (standardize fields, clean data)
    const p = normalizeProduct(r);
    
    // Infer the clothing role (top, bottom, footwear, accessory, or other)
    // based on product attributes like title, tags, category, etc.
    p.role = inferRole(p);

    // Add to the main products array
    products.push(p);
    
    // Index by SKU for quick lookup (if SKU exists)
    if (p.sku) bySku.set(p.sku, p);

    // Add to the appropriate role-based list
    // If role doesn't exist in map, default to "other"
    const list = byRole.get(p.role) || byRole.get("other");
    list.push(p);
  }

  // Return all organized product data
  return { products, bySku, byRole };
}

module.exports = { loadCatalog };
