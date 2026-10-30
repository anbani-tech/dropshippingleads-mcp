/**
 * Small, single-process admission limiter for an anonymous public MCP service.
 * State is in memory and resets on restart. This controls load, not paid access,
 * data-copying permissions, or a quota shared across multiple server instances.
 */
export function createRateLimiter({
  requestsPerMinute = 60,
  burst = 10,
  maxConcurrentPerClient = 4,
  maxConcurrentTotal = 64,
  maxClients = 10000,
  idleTtlMs = 600000,
  now = () => performance.now()
} = {}) {
  for (const [name, value] of Object.entries({ requestsPerMinute, burst, maxConcurrentPerClient, maxConcurrentTotal, maxClients, idleTtlMs })) {
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive safe integer`);
  }
  if (typeof now !== 'function') throw new TypeError('now must be a function');

  let lastTime = -Infinity;
  function time() {
    const value = now();
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('now must return a finite number');
    // A clock moving backwards must not replenish a bucket or reset its age.
    lastTime = Math.max(lastTime, value);
    return lastTime;
  }

  const clients = new Map();
  const tokensPerMs = requestsPerMinute / 60000;
  const sweepInterval = Math.min(idleTtlMs, 60000);
  let nextSweep = time() + sweepInterval;
  let concurrent = 0;
  const denied = (reason, statusCode, seconds = 1) => ({ allowed: false, reason, statusCode, retryAfter: Math.max(1, Math.ceil(seconds)) });

  function refill(client, stamp) {
    client.tokens = Math.min(burst, client.tokens + (stamp - client.updatedAt) * tokensPerMs);
    client.updatedAt = stamp;
  }

  function sweep(stamp) {
    if (stamp < nextSweep) return;
    nextSweep = stamp + sweepInterval;
    for (const [key, client] of clients) {
      if (client.active || stamp - client.lastSeen < idleTtlMs) continue;
      refill(client, stamp);
      // Retain rate debt even when an operator chooses a very short idle TTL.
      // Eviction must never give a still-depleted client a fresh burst.
      if (client.tokens === burst) clients.delete(key);
    }
  }

  function acquire(clientKey) {
    if (typeof clientKey !== 'string' || clientKey.length < 1 || clientKey.length > 256) throw new TypeError('clientKey must be a non-empty string of at most 256 characters');
    const stamp = time();
    sweep(stamp);
    let client = clients.get(clientKey);
    if (client) {
      refill(client, stamp);
      client.lastSeen = stamp;
      if (client.active >= maxConcurrentPerClient) return denied('client_concurrency', 429);
    }
    // Do not allocate client state for requests rejected by the global cap.
    if (concurrent >= maxConcurrentTotal) return denied('global_concurrency', 503);
    if (!client) {
      if (clients.size >= maxClients) return denied('capacity', 503, (nextSweep - stamp) / 1000);
      client = { tokens: burst, updatedAt: stamp, lastSeen: stamp, active: 0 };
      clients.set(clientKey, client);
    }
    if (client.tokens < 1) return denied('rate', 429, (1 - client.tokens) / tokensPerMs / 1000);
    client.tokens -= 1;
    client.active += 1;
    concurrent += 1;
    let released = false;
    return {
      allowed: true,
      release() {
        if (released) return;
        released = true;
        client.active -= 1;
        concurrent -= 1;
        // Cleanup must still free the concurrency slot if an injected clock
        // fails. Acquisition itself rejects invalid clock values above.
        try { client.lastSeen = time(); } catch { client.lastSeen = lastTime; }
      }
    };
  }
  return { acquire };
}
