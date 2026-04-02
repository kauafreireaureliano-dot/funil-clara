export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // MP envia o ID tanto no body quanto nos query params
    let paymentId = null;

    const url = new URL(request.url);
    const topicParam = url.searchParams.get('topic');
    const idParam = url.searchParams.get('id') || url.searchParams.get('data.id');

    const body = await request.json().catch(() => null);

    if (body?.type === 'payment' && body?.data?.id) {
      paymentId = String(body.data.id);
    } else if (topicParam === 'payment' && idParam) {
      paymentId = String(idParam);
    }

    if (!paymentId) return new Response('ok', { status: 200 });

    // Busca detalhes do pagamento no MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}` },
    });

    const payment = await mpRes.json();

    if (payment.status !== 'approved') return new Response('ok', { status: 200 });

    const email = payment.payer?.email;
    if (!email) return new Response('ok', { status: 200 });

    // Busca config para pegar links dos PDFs
    const origin = url.origin;
    const config = await fetch(`${origin}/config.json`).then(r => r.json()).catch(() => ({}));

    const pdfUrls  = config.pdfUrls  || [];
    const pdfNames = config.pdfNames || [];

    const pdfItems = pdfUrls.map((pdfUrl, i) => `
      <div style="border:1px solid #e9edef;border-radius:10px;padding:14px 16px;margin-bottom:12px">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:28px;width:44px;vertical-align:middle">📄</td>
          <td style="vertical-align:middle;padding-left:12px">
            <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#111">${pdfNames[i] || 'PDF ' + (i + 1)}</p>
            <a href="${pdfUrl}" style="background:#25d366;color:white;text-decoration:none;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:700;display:inline-block">⬇️ Baixar PDF</a>
          </td>
        </tr></table>
      </div>
    `).join('');

    const emailHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:24px 16px">
    <table style="max-width:480px;width:100%" cellpadding="0" cellspacing="0">

      <tr><td style="background:#128C7E;border-radius:12px 12px 0 0;padding:28px;text-align:center">
        <div style="font-size:44px;margin-bottom:8px">🎉</div>
        <h1 style="color:white;margin:0;font-size:22px;font-weight:700">Pagamento confirmado!</h1>
        <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px">Seus PDFs estão prontos para download</p>
      </td></tr>

      <tr><td style="background:white;padding:24px;border-radius:0 0 12px 12px">
        <p style="color:#333;font-size:15px;margin:0 0 20px">Olá! Obrigada pela sua compra 💚 Aqui estão seus materiais:</p>
        ${pdfItems}
        <div style="background:#e8f5e9;border-radius:8px;padding:14px 16px;margin-top:20px">
          <p style="margin:0;color:#1b5e20;font-size:13px;line-height:1.6">
            ♾️ <strong>Acesso vitalício</strong> — guarde esse email, os links não expiram nunca!
          </p>
        </div>
        <p style="color:#aaa;font-size:12px;text-align:center;margin:20px 0 0;line-height:1.8">
          Com carinho, <strong style="color:#128C7E">Clara Aureliano</strong> 💚<br>
          Alguma dúvida? Responda esse email.
        </p>
      </td></tr>

      <tr><td style="text-align:center;padding:16px">
        <p style="color:#bbb;font-size:11px;margin:0">🔒 Email enviado automaticamente após confirmação de pagamento via PIX</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM || 'Clara Aureliano <onboarding@resend.dev>',
        to: [email],
        subject: '🎉 Seus PDFs chegaram! Receitas da Clara Aureliano',
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      console.error('Resend error:', await resendRes.text());
    }

    return new Response('ok', { status: 200 });

  } catch (err) {
    console.error('Webhook error:', err.message);
    return new Response('ok', { status: 200 }); // Sempre 200 pro MP não retentar infinito
  }
}
