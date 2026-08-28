import { evaluateHousehold } from '../../lib/benefits.mjs';

const MAX_BODY_BYTES = 32 * 1024;

function json(data, status) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

export default async (request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'POST required' }, 405);

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ ok: false, error: 'application/json required' }, 415);
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: 'Request body too large' }, 413);
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return json({ ok: false, error: 'Request body too large' }, 413);
    }
    const body = JSON.parse(text);
    const result = evaluateHousehold(body?.household || body || {});
    return json(result, result.ok ? 200 : 400);
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }
};
