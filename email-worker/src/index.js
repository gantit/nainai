export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders(),
      });
    }
    try {
      const { to, subject, text, from } = await request.json();
      if (!to || !subject || !text) {
        return new Response("Missing fields", {
          status: 400,
          headers: corsHeaders(),
        });
      }
      if (!env.RESEND_API_KEY) {
        return new Response(
          JSON.stringify({
            mock: true,
            sent: false,
            reason: "NO_API_KEY",
            preview: { to, subject, text },
          }),
          {
            status: 200,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          }
        );
      }
      const payload = {
        from: from || "Nai Stores <no-reply@nai.local>",
        to: [to],
        subject,
        text,
      };
      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!resendResp.ok) {
        const errTxt = await resendResp.text();
        return new Response("Resend error: " + errTxt, {
          status: 502,
          headers: corsHeaders(),
        });
      }
      const data = await resendResp.json();
      return new Response(JSON.stringify({ sent: true, id: data.id }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response("Error: " + e.message, {
        status: 500,
        headers: corsHeaders(),
      });
    }
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}
