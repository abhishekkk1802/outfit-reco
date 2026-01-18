require("dotenv").config();
const { loadCatalog } = require("./data/loadCatalog");
const { createApp } = require("./app");

const PORT = process.env.PORT || 3000;
const EXCEL_PATH = process.env.EXCEL_PATH || "./Sample Products.xlsx";

const catalog = loadCatalog({ filePath: EXCEL_PATH });
const app = createApp({ catalog });

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  console.log(`Loaded products: ${catalog.products.length}`);
  console.log(`Products by role:`);
  console.log(`  - Top: ${catalog.byRole.get("top")?.length || 0}`);
  console.log(`  - Bottom: ${catalog.byRole.get("bottom")?.length || 0}`);
  console.log(`  - Footwear: ${catalog.byRole.get("footwear")?.length || 0}`);
  console.log(`  - Accessory: ${catalog.byRole.get("accessory")?.length || 0}`);
  console.log(`  - Other: ${catalog.byRole.get("other")?.length || 0}`);
});
