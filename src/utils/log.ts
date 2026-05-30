// Safe logger — strip PII / API key / amount khỏi production logs.
// Bảo mật: KHÔNG bao giờ log raw secrets.
const SENSITIVE_KEYS = [
  'api_key',
  'apiKey',
  'pin',
  'pin_hash',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'amount',
  'email',
  'phone',
];

function redact(obj: any, depth = 0): any {
  if (depth > 5) return '[deep]';
  if (obj == null) return obj;
  if (typeof obj === 'string') {
    // Mask API key pattern (AIza...) và token Anthropic (sk-ant-...)
    return obj.replace(/AIza[a-zA-Z0-9_-]{20,}/g, 'AIza***').replace(/sk-ant-[a-zA-Z0-9-_]{30,}/g, 'sk-ant-***');
  }
  if (Array.isArray(obj)) return obj.map((x) => redact(x, depth + 1));
  if (typeof obj === 'object') {
    const out: any = {};
    for (const k of Object.keys(obj)) {
      if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
        out[k] = typeof obj[k] === 'string' && obj[k].length > 6
          ? `${String(obj[k]).slice(0, 3)}***${String(obj[k]).slice(-2)}`
          : '***';
      } else {
        out[k] = redact(obj[k], depth + 1);
      }
    }
    return out;
  }
  return obj;
}

export const safeLog = {
  info: (msg: string, data?: any) => {
    if (__DEV__) console.log(`[bop] ${msg}`, data !== undefined ? redact(data) : '');
  },
  warn: (msg: string, data?: any) => {
    if (__DEV__) console.warn(`[bop] ${msg}`, data !== undefined ? redact(data) : '');
  },
  error: (msg: string, err?: any) => {
    if (__DEV__) console.error(`[bop] ${msg}`, err !== undefined ? redact(err) : '');
  },
};
