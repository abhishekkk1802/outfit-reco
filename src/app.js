const express = require("express");
const { productsRouter } = require("./routes/products");
const { recommendationsRouter } = require("./routes/recommendations");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");
const fs = require("fs");
const path = require("path");

function createApp({ catalog }) {
  const app = express();
  app.use(express.json());

  // Serve static files from public directory
  const publicPath = path.join(__dirname, "..", "public");
  app.use(express.static(publicPath));

  app.get("/health", (req, res) => res.json({ ok: true }));

  // Swagger
  const swaggerPath = path.join(__dirname, "docs", "openapi.yaml");
  if (fs.existsSync(swaggerPath)) {
    const doc = YAML.parse(fs.readFileSync(swaggerPath, "utf8"));
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(doc));
  }

  app.use("/products", productsRouter({ catalog }));
  app.use("/recommendations", recommendationsRouter({ catalog }));

  return app;
}

module.exports = { createApp };
