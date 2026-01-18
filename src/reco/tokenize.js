function tokenize(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }
  
  module.exports = { tokenize };
  