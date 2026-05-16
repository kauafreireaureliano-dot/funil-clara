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
    let todaySalesCount = 0;
    const salesByDay   = {};
    const recentSales  = [];
    const seenSales    = new Set(); // dedup por session_id (= payment_<id>)
    const today        = new Date().toISOString().slice(0, 10);

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
        if (seenSales.has(e.session_id)) continue;
        seenSales.add(e.session_id);
        // Parse value — pode ser JSON {amount,email,name} ou número legado
        let amount = 0, buyerEmail = '', buyerName = '';
        try {
          const parsed = JSON.parse(e.value);
          amount = parseFloat(parsed.amount) || 0;
          buyerEmail = parsed.email || '';
          buyerName  = parsed.name  || '';
        } catch {
          amount = parseFloat(e.value) || 0;
        }
        totalRevenue += amount;
        salesCount++;
        const day = e.created_at.slice(0, 10);
        salesByDay[day] = (salesByDay[day] || 0) + amount;
        if (day === today) todaySalesCount++;
        recentSales.push({ amount, email: buyerEmail, name: buyerName, funnel: e.step_id, created_at: e.created_at });
      }
    }

    // All-time sales (sem filtro de data)
    const allRes = await fetch(
      `${SUPA_URL}/rest/v1/funnel_events?event_type=eq.sale_confirmed&order=created_at.desc&limit=500`,
      { headers: { 'Authorization': `Bearer ${SUPA_KEY}`, 'apikey': SUPA_KEY } }
    );
    const allSaleEvents = await allRes.json().catch(() => []);
    let allTimeRevenue = 0, allTimeSales = 0;
    const seenAll = new Set();
    if (Array.isArray(allSaleEvents)) {
      for (const e of allSaleEvents) {
        if (seenAll.has(e.session_id)) continue;
        seenAll.add(e.session_id);
        try {
          const p = JSON.parse(e.value);
          allTimeRevenue += parseFloat(p.amount) || 0;
        } catch {
          allTimeRevenue += parseFloat(e.value) || 0;
        }
        allTimeSales++;
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
      total_sessions:     total,
      total_conversions:  conv,
      conversion_rate:    total > 0 ? Math.round(conv / total * 1000) / 10 : 0,
      total_revenue:      Math.round(totalRevenue * 100) / 100,
      today_revenue:      Math.round((salesByDay[today] || 0) * 100) / 100,
      today_sales_count:  todaySalesCount,
      sales_count:        salesCount,
      sales_by_day:       salesByDay,
      all_time_revenue:   Math.round(allTimeRevenue * 100) / 100,
      all_time_sales:     allTimeSales,
      recent_sales:       recentSales.slice(-30).reverse(),
      steps,
      captures:           captures.slice(-100).reverse(),
      hours:              hourCounts,
      peak_hour:          peakHour,
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
