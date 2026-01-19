const IORedis = require("ioredis");

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");

// Connection event listeners
redis.on('connect', () => {
  console.log('✓ Redis: Connection established');
});

redis.on('ready', () => {
  console.log('✓ Redis: Client ready to accept commands');
});

redis.on('error', (err) => {
  console.error('✗ Redis: Connection error -', err.message);
});

redis.on('close', () => {
  console.log('⚠ Redis: Connection closed');
});

redis.on('reconnecting', () => {
  console.log('⟳ Redis: Attempting to reconnect...');
});

module.exports = { redis };
