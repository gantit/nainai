export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders() });
    }
    try {
      const body = await request.json();
      const { prompt, imageBase64, mimeType } = body || {};
      if (!prompt) {
        return new Response('Missing prompt', { status: 400, headers: corsHeaders() });
      }
      const parts = [];
      if (imageBase64) {
        parts.push({ inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } });
      }
      parts.push({ text: prompt });

      const payload = { contents: [{ role: 'user', parts }] };
      const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=' + env.GEMINI_API_KEY;
      const upstream = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!upstream.ok) {
        const text = await upstream.text();
        return new Response('Upstream error: ' + text, { status: 502, headers: corsHeaders() });
      }
      const json = await upstream.json();
      const answer = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return new Response(JSON.stringify({ text: answer }), {
        status: 200,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response('Error: ' + e.message, { status: 500, headers: corsHeaders() });
    }
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
}
