export async function onRequestPost(context) {
  const { request, env } = context;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const { email, valor, produto } = await request.json();

    if (!email || !valor) {
      return new Response(JSON.stringify({ erro: 'Email e valor são obrigatórios' }), { status: 400, headers });
    }

    const amount = parseFloat(String(valor).replace(',', '.'));
    const origin = new URL(request.url).origin;

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: produto || 'Apostilas Clara Aureliano',
        payment_method_id: 'pix',
        payer: { email },
        metadata: { buyer_email: email },
        notification_url: `${origin}/api/webhook`,
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }),
    });

    const data = await mpRes.json();

    if (!mpRes.ok) {
      console.error('MP error:', JSON.stringify(data));
      return new Response(JSON.stringify({ erro: data.message || 'Erro ao criar pagamento' }), { status: 500, headers });
    }

    const txData = data.point_of_interaction?.transaction_data;

    return new Response(JSON.stringify({
      id: data.id,
      qr_code: txData?.qr_code,
      qr_code_base64: txData?.qr_code_base64,
    }), { headers });

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
