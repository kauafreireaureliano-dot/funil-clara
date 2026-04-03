export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin;

  let pixelId = context.env.META_PIXEL_ID || '';

  // Fallback: lê do config.json se env var não estiver configurada
  if (!pixelId) {
    try {
      const cfg = await fetch(`${origin}/config.json`).then(r => r.json());
      pixelId = cfg.metaPixelId || '';
    } catch { /* ignora */ }
  }

  const js = pixelId
    ? `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`
    : '/* meta pixel: pixel id not configured */';

  return new Response(js, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
