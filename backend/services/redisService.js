const { getRedisClient } = require('../config/redisConfig');
const logger = require('../utils/logger.js');

const DEFAULT_TTL = 3600;

// JSON cache on top of Redis. Every method is safe to call while Redis is
// switched off (IS_REDIS_SERVER_ON != 1) or unreachable: reads return null
// (a cache miss), writes return false, and getOrSet simply calls its fetch
// function - so callers never need their own "is Redis up?" check.
class RedisService {
  isRedisEnabled() {
    return process.env.IS_REDIS_SERVER_ON === "1";
  }

  getClient() {
    const client = getRedisClient();

    if (!client) {
      logger.logInfo(0, 1, "Redis not available");
      return null;
    }

    return client;
  }

  // A missing or non-string key is a bug in the caller, never a valid lookup.
  validateKey(key) {
    if (!key || typeof key !== "string") {
      throw new Error(`Invalid Redis key: ${JSON.stringify(key)}`);
    }
  }

  safeParse(data, key) {
    try {
      return JSON.parse(data);
    } catch (err) {
      logger.logWarning("Invalid JSON in Redis", { key });
      return null;
    }
  }

  async get(key) {
    try {
      this.validateKey(key);

      if (!this.isRedisEnabled()) return null;

      const client = this.getClient();
      if (!client) return null;

      const data = await client.get(key);

      if (data === null) {
        logger.logInfo(0, 1, "Cache MISS", { key });
        return null;
      }

      logger.logInfo(null, null, "Cache HIT", { key });

      return this.safeParse(data, key);
    } catch (err) {
      logger.logWarning("Redis GET error", { key, err });
      return null;
    }
  }

  async set(key, value, ttl = DEFAULT_TTL) {
    try {
      this.validateKey(key);

      if (!this.isRedisEnabled()) return false;

      const client = this.getClient();
      if (!client) return false;

      if (ttl <= 0) ttl = DEFAULT_TTL;

      await client.setEx(key, ttl, JSON.stringify(value));

      logger.logInfo(1, 0, "Cache SET", { key, ttl });

      return true;
    } catch (err) {
      logger.logWarning("Redis SET error", { key, err });
      return false;
    }
  }

  async del(key) {
    try {
      this.validateKey(key);

      if (!this.isRedisEnabled()) return false;

      const client = this.getClient();
      if (!client) return false;

      await client.del(key);

      logger.logInfo(null, null, "Cache DEL", { key });

      return true;
    } catch (err) {
      logger.logWarning("Redis DEL error", { key, err });
      return false;
    }
  }

  // Distributed lock (SET NX PX): makes a periodic background job safe to run
  // when the app is scaled to several instances - only one instance's run
  // goes ahead at a time. With Redis switched off there is only one process,
  // so the lock is always "acquired".
  async acquireLock(key, ttlSeconds) {
    try {
      this.validateKey(key);

      if (!this.isRedisEnabled()) return true;

      const client = this.getClient();
      if (!client) return true;

      const result = await client.set(key, '1', { NX: true, PX: ttlSeconds * 1000 });
      return result !== null;
    } catch (err) {
      logger.logWarning("Redis acquireLock error", { key, err });
      return false;
    }
  }

  async releaseLock(key) {
    try {
      this.validateKey(key);

      if (!this.isRedisEnabled()) return;

      const client = this.getClient();
      if (!client) return;

      await client.del(key);
    } catch (err) {
      logger.logWarning("Redis releaseLock error", { key, err });
    }
  }

  // Returns the cached value, or calls fetchFunction, caches what it returns
  // (unless null/undefined) and returns that.
  async getOrSet(key, fetchFunction, ttl = DEFAULT_TTL) {
    this.validateKey(key);

    const cached = await this.get(key);
    if (cached !== null) return cached;

    logger.logInfo(null, null, "Cache MISS - fetching", { key });

    // Called once, outside any try/catch: an error from the fetch itself
    // (e.g. MongoDB down) reaches the caller instead of being retried.
    const freshData = await fetchFunction();

    if (freshData !== null && freshData !== undefined) {
      await this.set(key, freshData, ttl);
    }

    return freshData;
  }
}

module.exports = new RedisService();
