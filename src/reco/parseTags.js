const { tokenize } = require("./tokenize");

function parseTagsCell(tagsCell) {
  if (!tagsCell) return [];
  // tags look like: ['Crew Length', 'socks']
  const cleaned = String(tagsCell).replace(/\[|\]|'|"/g, " ");
  return tokenize(cleaned);
}

module.exports = { parseTagsCell };
