const { tokenize } = require("./tokenize");
const { parseTagsCell } = require("./parseTags");

const COLORS = new Set([
  "black","white","grey","gray","cream","beige","tan","brown",
  "red","maroon","burgundy","blue","navy","green","olive",
  "yellow","gold","silver","pink","purple","orange"
]);

const SEASONS = new Set(["winter","summer","spring","autumn","fall","monsoon"]);
const OCCASIONS = new Set(["casual","formal","party","wedding","office","work","gym","sports","streetwear"]);

const STYLES = new Set(["streetwear","minimal","classic","athleisure","oversized","vintage","preppy"]);

function normalizeProduct(row) {
  const sku = String(row.sku_id || "").trim();
  const title = String(row.title || "").trim();
  const brand = String(row.brand_name || "").trim();
  const category = String(row.category || "").trim();
  const subCategory = String(row.sub_category || "").trim();
  const productType = String(row.product_type || "").trim();
  const gender = String(row.gender || "").trim().toLowerCase();
  const price = Number(row.lowest_price || 0);

  const tags = parseTagsCell(row.tags);

  const text = `${title} ${brand} ${category} ${subCategory} ${productType} ${tags.join(" ")}`.toLowerCase();
  const tokens = tokenize(text);

  const colors = [...new Set(tokens.filter(t => COLORS.has(t)))];
  const seasons = [...new Set(tokens.filter(t => SEASONS.has(t)))];
  const occasions = [...new Set(tokens.filter(t => OCCASIONS.has(t)))];
  const styles = [...new Set(tokens.filter(t => STYLES.has(t)))];

  const image = String(row.featured_image || "").trim();

  return {
    sku,
    title,
    brand,
    category,
    subCategory,
    productType,
    gender,
    price,
    tags,
    tokens,
    colors,
    seasons,
    occasions,
    styles,
    image
  };
}

module.exports = { normalizeProduct };
