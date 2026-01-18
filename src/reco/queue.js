const { Queue } = require("bullmq");
const { redis } = require("./redis");

// BullMQ requires maxRetriesPerRequest: null for blocking operations
const connection = redis.duplicate({
  maxRetriesPerRequest: null
});
const aiQueue = new Queue("ai-explanations", { connection });

module.exports = { aiQueue, connection };
