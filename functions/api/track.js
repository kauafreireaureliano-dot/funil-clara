const SUPA_URL = 'https://badgaqasjnosakzducjc.supabase.co';
const SUPA_KEY = 'sb_publishable_-QVzljjE1sOYbO_ioSjYOA_1VaakZ5c';

export async function onRequestPost(context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };
  try {
    const { session_id, step_id, step_type, event_type, value } = await context.request.json();
    if (!session_id || !event_type) return new Response('ok', { headers });
    context.waitUntil(
      fetch(`${SUPA_URL}/rest/v1/funnel_events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPA_KEY}`,
          'apikey': SUPA_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ session_id, step_id, step_type, event_type, value }),
      }).catch(() => {})
    );
    return new Response('ok', { headers });
  } catch {
    return new Response('ok', { headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
