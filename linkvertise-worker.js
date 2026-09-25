/* CihuyAkz — Linkvertise Anti-Bypass verifier (Cloudflare Workers)
 *
 * Deploy this Worker and add a secret named LINKVERTISE_TOKEN.
 * The token NEVER belongs in the frontend.
 *
 * Linkvertise sends users back to the target URL with ?hash=... after the
 * ad-step. This worker verifies that one-time hash server-to-server.
 */

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return json({ verified: false, error: 'Method not allowed' }, 405);
    if (!env.LINKVERTISE_TOKEN) return json({ verified: false, error: 'LINKVERTISE_TOKEN is not configured' }, 500);

    let hash = '';
    try {
      const body = await request.json();
      hash = String(body?.hash || '').trim();
    } catch (_) {
      return json({ verified: false, error: 'Invalid JSON body' }, 400);
    }

    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      return json({ verified: false, error: 'Invalid hash' }, 400);
    }

    const verifyUrl = new URL('https://publisher.linkvertise.com/api/v1/anti_bypassing');
    verifyUrl.searchParams.set('token', env.LINKVERTISE_TOKEN);
    verifyUrl.searchParams.set('hash', hash);

    try {
      const upstream = await fetch(verifyUrl.toString(), { method: 'POST' });
      const text = (await upstream.text()).trim().toUpperCase();

      // Linkvertise returns TRUE only when the hash exists and is consumed.
      // It returns FALSE for a missing/expired/already-used hash.
      if (text === 'TRUE') return json({ verified: true });
      if (text === 'FALSE') return json({ verified: false, error: 'Hash invalid, expired, or already used' }, 403);
      if (text === 'INVALID TOKEN.') return json({ verified: false, error: 'Invalid Linkvertise token' }, 500);

      return json({ verified: false, error: 'Unexpected Linkvertise response' }, 502);
    } catch (_) {
      return json({ verified: false, error: 'Linkvertise verification request failed' }, 502);
    }
  }
};
