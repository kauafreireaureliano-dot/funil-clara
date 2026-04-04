const SUPA_URL = 'https://badgaqasjnosakzducjc.supabase.co';
const SUPA_KEY = 'sb_publishable_-QVzljjE1sOYbO_ioSjYOA_1VaakZ5c';
const KEEP_DAYS = 30;

export async function onRequestGet(context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  };
  try {
    const url  = new URL(context.request.url);
    const days = parseInt(url.searchParams.get('days') || '7');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // ── Auto-cleanup: apaga eventos com mais de KEEP_DAYS dias ──
    const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
    context.waitUntil(
      fetch(`${SUPA_URL}/rest/v1/funnel_events?created_at=lt.${encodeURIComponent(cutoff)}&event_type=neq.sale_confirmed`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${SUPA_KEY}`, 'apikey': SUPA_KEY },
      }).catch(() => {})
    );

    const res = await fetch(
      `${SUPA_URL}/rest/v1/funnel_events?created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=10000`,
      { headers: { 'Authorization': `Bearer ${SUPA_KEY}`, 'apikey': SUPA_KEY } }
    );
    const events = await res.json();

    if (!Array.isArray(events)) {
      return new Response(JSON.stringify({ error: 'Supabase error', detail: events }), { status: 500, headers });
    }

    const sessions    = new Set();
    const conversions = new Set();
    const stepSessions = {};
    const stepTypes    = {};
    const captures     = [];
    const hourCounts   = new Array(24).fill(0);

    // Sales
    let totalRevenue   = 0;
    let salesCount     = 0;
    const salesByDay   = {};

    for (const e of events) {
      if (e.event_type === 'page_view') {
        sessions.add(e.session_id);
        hourCounts[new Date(e.created_at).getHours()]++;
      }
      if (e.event_type === 'step_reached') {
        if (!stepSessions[e.step_id]) stepSessions[e.step_id] = new Set();
        stepSessions[e.step_id].add(e.session_id);
        if (e.step_type) stepTypes[e.step_id] = e.step_type;
      }
      if (e.event_type === 'capture_response') {
        captures.push({ value: e.value, session_id: e.session_id, created_at: e.created_at });
      }
      if (e.event_type === 'payment_click') {
        conversions.add(e.session_id);
      }
      if (e.event_type === 'sale_confirmed') {
        const amount = parseFloat(e.value) || 0;
        totalRevenue += amount;
        salesCount++;
        const day = e.created_at.slice(0, 10);
        salesByDay[day] = (salesByDay[day] || 0) + amount;
      }
    }

    const total = sessions.size;
    const conv  = conversions.size;

    const steps = Object.entries(stepSessions).map(([id, set]) => ({
      step_id:   id,
      step_type: stepTypes[id] || '',
      count:     set.size,
      pct:       total > 0 ? Math.round(set.size / total * 100) : 0,
    })).sort((a, b) => {
      const n = x => parseInt(x.step_id?.replace(/\D/g, '') || '0');
      return n(a) - n(b);
    });

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

    // Today's revenue
    const today = new Date().toISOString().slice(0, 10);
    const todayRevenue = salesByDay[today] || 0;

    return new Response(JSON.stringify({
      total_sessions:    total,
      total_conversions: conv,
      conversion_rate:   total > 0 ? Math.round(conv / total * 1000) / 10 : 0,
      total_revenue:     Math.round(totalRevenue * 100) / 100,
      today_revenue:     Math.round(todayRevenue * 100) / 100,
      sales_count:       salesCount,
      sales_by_day:      salesByDay,
      steps,
      captures:          captures.slice(-100).reverse(),
      hours:             hourCounts,
      peak_hour:         peakHour,
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
