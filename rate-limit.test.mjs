import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from './rate-limit.mjs';

function fixture(options = {}) {
  let stamp = 0;
  return { limiter: createRateLimiter({ ...options, now: () => stamp }), setTime(value) { stamp = value; } };
}
function complete(limiter, key) {
  const grant = limiter.acquire(key);
  assert.equal(grant.allowed, true, JSON.stringify(grant));
  grant.release();
  return grant;
}

test('limiter validates configuration, client keys, and the clock before admission', () => {
  for (const key of ['requestsPerMinute', 'burst', 'maxConcurrentPerClient', 'maxConcurrentTotal', 'maxClients', 'idleTtlMs']) {
    for (const value of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '10']) assert.throws(() => createRateLimiter({ [key]: value }), TypeError);
  }
  assert.throws(() => createRateLimiter({ now: 1 }), TypeError);
  assert.throws(() => createRateLimiter({ now: () => NaN }), TypeError);
  const { limiter } = fixture();
  for (const key of ['', null, 123, 'a'.repeat(257)]) assert.throws(() => limiter.acquire(key), TypeError);
});

test('a token bucket admits its burst then recovers at the configured average rate', () => {
  const { limiter, setTime } = fixture({ requestsPerMinute: 60, burst: 2 });
  complete(limiter, 'a'); complete(limiter, 'a');
  assert.deepEqual(limiter.acquire('a'), { allowed: false, reason: 'rate', statusCode: 429, retryAfter: 1 });
  setTime(500);
  assert.equal(limiter.acquire('a').allowed, false);
  setTime(1000);
  complete(limiter, 'a');
  assert.equal(limiter.acquire('a').reason, 'rate');
  setTime(1000000);
  complete(limiter, 'a'); complete(limiter, 'a');
  assert.equal(limiter.acquire('a').reason, 'rate', 'idle time cannot accumulate more than the burst capacity');
});

test('rate debt is isolated per client and Retry-After is rounded up to seconds', () => {
  const { limiter, setTime } = fixture({ requestsPerMinute: 2, burst: 1 });
  complete(limiter, 'a'); complete(limiter, 'b');
  assert.equal(limiter.acquire('a').retryAfter, 30);
  setTime(1001);
  assert.equal(limiter.acquire('a').retryAfter, 29);
  setTime(30000);
  complete(limiter, 'a'); complete(limiter, 'b');
});

test('per-client concurrent rejection spends no token and release is idempotent', () => {
  const { limiter } = fixture({ burst: 2, maxConcurrentPerClient: 1 });
  const first = limiter.acquire('a');
  assert.equal(first.allowed, true);
  assert.deepEqual(limiter.acquire('a'), { allowed: false, reason: 'client_concurrency', statusCode: 429, retryAfter: 1 });
  first.release(); first.release();
  const second = limiter.acquire('a');
  assert.equal(second.allowed, true);
  first.release();
  assert.equal(limiter.acquire('a').reason, 'client_concurrency', 'a duplicate release cannot free another request slot');
  second.release();
  assert.equal(limiter.acquire('a').reason, 'rate', 'release does not refund spent tokens');
});

test('global concurrency caps all clients without allocating a rejected new client', () => {
  const { limiter } = fixture({ burst: 3, maxConcurrentTotal: 2, maxClients: 3 });
  const a = limiter.acquire('a'), b = limiter.acquire('b');
  assert.equal(a.allowed, true); assert.equal(b.allowed, true);
  assert.deepEqual(limiter.acquire('not-allocated'), { allowed: false, reason: 'global_concurrency', statusCode: 503, retryAfter: 1 });
  a.release(); a.release();
  const c = limiter.acquire('c');
  assert.equal(c.allowed, true, 'the rejected client did not occupy the remaining client-state slot');
  assert.equal(limiter.acquire('a').reason, 'global_concurrency');
  b.release(); c.release();
  complete(limiter, 'a');
});

test('a full client-state table fails closed and preserves rate debt beyond the idle TTL', () => {
  const { limiter, setTime } = fixture({ requestsPerMinute: 1, burst: 1, maxClients: 1, idleTtlMs: 10 });
  complete(limiter, 'a');
  assert.equal(limiter.acquire('b').reason, 'capacity');
  setTime(11);
  const denied = limiter.acquire('b');
  assert.equal(denied.statusCode, 503); assert.equal(denied.reason, 'capacity'); assert.ok(denied.retryAfter >= 1);
  assert.equal(limiter.acquire('a').reason, 'rate', 'an expired but depleted client cannot reset its burst');
  setTime(60000);
  complete(limiter, 'b');
  assert.equal(limiter.acquire('a').reason, 'capacity');
});

test('idle cleanup never evicts an active request, then reclaims a recovered inactive entry', () => {
  const { limiter, setTime } = fixture({ requestsPerMinute: 60, burst: 1, maxClients: 1, idleTtlMs: 10 });
  const active = limiter.acquire('a');
  setTime(60000);
  assert.equal(limiter.acquire('b').reason, 'capacity');
  active.release();
  setTime(60011);
  complete(limiter, 'b');
});

test('backward clock movement grants no credit and invalid clock values fail closed', () => {
  const { limiter, setTime } = fixture({ requestsPerMinute: 60, burst: 1 });
  setTime(100);
  complete(limiter, 'a');
  setTime(50);
  assert.equal(limiter.acquire('a').reason, 'rate');
  setTime(1000);
  assert.equal(limiter.acquire('a').reason, 'rate');
  setTime(1100);
  const active = limiter.acquire('a');
  assert.equal(active.allowed, true);
  setTime(Infinity);
  assert.throws(() => limiter.acquire('b'), TypeError);
  assert.doesNotThrow(() => active.release(), 'release still clears a held slot when the injected clock is invalid');
  setTime(2100);
  complete(limiter, 'a');
});
