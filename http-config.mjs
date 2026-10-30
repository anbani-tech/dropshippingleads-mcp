import { isIP } from 'node:net';

function integer(env, name, fallback, min, max) {
  const value = env[name] ?? String(fallback);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return Number(value);
}

export function normalizeIp(value) {
  if (typeof value !== 'string' || value.includes('%') || !isIP(value)) return null;
  if (isIP(value) === 4) return value;
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  if (canonical.startsWith('::ffff:')) {
    const parts = canonical.slice(7).split(':');
    if (parts.length === 2) {
      const hi = parseInt(parts[0], 16), lo = parseInt(parts[1], 16);
      return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
    }
  }
  return canonical;
}

function publicOrigin(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} must be a canonical HTTPS origin`); }
  const host = url.hostname;
  if (url.protocol !== 'https:' || value !== url.origin || url.username || url.password ||
      isIP(host) || host.startsWith('[') || !host.includes('.') || host.endsWith('.') ||
      !/^[a-z0-9.-]+$/.test(host) || host.split('.').some(part => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)) ||
      /(^|\.)(localhost|local|internal|lan|invalid|example|test)$/.test(host) ||
      /(^|\.)example\.(com|org|net)$/.test(host) || /replace/i.test(host)) {
    throw new Error(`${label} must be a canonical HTTPS origin with a real configured DNS name, without paths or placeholders`);
  }
  return url.origin;
}

function list(raw, label) {
  if (typeof raw !== 'string') throw new Error(`${label} must be a comma-separated list`);
  const values = raw.split(',').map(v => v.trim());
  if (!values.length || values.length > 32 || values.some(v => !v) || new Set(values).size !== values.length) {
    throw new Error(`${label} must contain 1..32 unique non-empty values`);
  }
  return values;
}

/** Same-host reverse proxy only. This never opens a public listener or changes a website. */
export function loadHttpConfig(env = process.env) {
  const mode = env.DSL_HTTP_MODE ?? 'local';
  if (!['local', 'proxy'].includes(mode)) throw new Error('DSL_HTTP_MODE must be local or proxy');
  if (env.DSL_HTTP_HOST !== undefined && env.DSL_HTTP_HOST !== '127.0.0.1') throw new Error('DSL_HTTP_HOST must remain 127.0.0.1');
  let origin = null, allowedOrigins = [], trustedProxyIps = [];
  if (mode === 'proxy') {
    origin = publicOrigin(env.DSL_PUBLIC_ORIGIN, 'DSL_PUBLIC_ORIGIN');
    allowedOrigins = list(env.DSL_ALLOWED_ORIGINS ?? origin, 'DSL_ALLOWED_ORIGINS').map(v => publicOrigin(v, 'DSL_ALLOWED_ORIGINS'));
    trustedProxyIps = list(env.DSL_TRUSTED_PROXY_IPS, 'DSL_TRUSTED_PROXY_IPS').map(v => {
      const ip = normalizeIp(v);
      if (!['127.0.0.1', '::1'].includes(ip)) throw new Error('DSL_TRUSTED_PROXY_IPS supports only exact same-host loopback IPs (127.0.0.1 or ::1)');
      return ip;
    });
    if (new Set(trustedProxyIps).size !== trustedProxyIps.length) throw new Error('DSL_TRUSTED_PROXY_IPS contains duplicate normalized addresses');
    if (!trustedProxyIps.includes('127.0.0.1')) throw new Error('DSL_TRUSTED_PROXY_IPS must include 127.0.0.1 to match the IPv4 loopback listener');
  } else if (['DSL_PUBLIC_ORIGIN', 'DSL_ALLOWED_ORIGINS', 'DSL_TRUSTED_PROXY_IPS'].some(k => env[k] !== undefined)) {
    throw new Error('Public origin / proxy settings require explicit DSL_HTTP_MODE=proxy');
  }
  const limits = Object.freeze({
    requestsPerMinute: integer(env, 'DSL_RATE_PER_MINUTE', 60, 1, 60000),
    burst: integer(env, 'DSL_RATE_BURST', 10, 1, 1000),
    maxConcurrentPerClient: integer(env, 'DSL_RATE_MAX_CONCURRENT_PER_CLIENT', 4, 1, 128),
    maxConcurrentTotal: integer(env, 'DSL_RATE_MAX_CONCURRENT_TOTAL', 64, 1, 1024),
    maxClients: integer(env, 'DSL_RATE_MAX_CLIENTS', 10000, 1, 100000)
  });
  return Object.freeze({mode, bindHost: '127.0.0.1', port: integer(env, 'DSL_HTTP_PORT', 54170, 1, 65535),
    publicOrigin: origin, publicHost: origin ? new URL(origin).host : null,
    allowedOrigins: Object.freeze(allowedOrigins), trustedProxyIps: Object.freeze(trustedProxyIps), limits});
}
