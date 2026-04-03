export async function onRequestPost(context) {
  const { request } = context;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const { url } = await request.json();
    if (!url) return new Response(JSON.stringify({ erro: 'URL obrigatória' }), { status: 400, headers });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'teste',
        email: 'teste@claraureliano.com',
        valor: '1,99',
        produto: 'Teste de notificação — Dashboard',
        payment_id: 'TEST_' + Date.now(),
        timestamp: new Date().toISOString(),
      }),
    });

    return new Response(JSON.stringify({ ok: res.ok, status: res.status }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), { status: 500, headers });
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
