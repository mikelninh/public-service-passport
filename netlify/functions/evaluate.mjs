import { evaluateHousehold } from '../../lib/benefits.mjs';

export default async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'POST required' }, { status: 405 });
  }

  try {
    const body = await request.json();
    const result = evaluateHousehold(body?.household || body || {});
    return Response.json(result, {
      status: result.ok ? 200 : 400,
      headers: { 'cache-control': 'no-store' }
    });
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }
};
