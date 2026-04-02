export async function onRequestGet(context) {
  const { request, env } = context;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const id = new URL(request.url).searchParams.get('id');

  if (!id) {
    return new Response(JSON.stringify({ erro: 'ID obrigatório' }), { status: 400, headers });
  }

  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}` },
    });

    const data = await res.json();

    return new Response(JSON.stringify({ status: data.status }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), { status: 500, headers });
  }
}
