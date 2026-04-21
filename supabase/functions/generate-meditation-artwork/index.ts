import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { meditationId, imagePrompt: promptOverride } = await req.json();
    if (!meditationId) {
      return new Response(JSON.stringify({ error: "meditationId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Load meditation row to get the prompt if not provided
    let imagePrompt = promptOverride as string | undefined;
    if (!imagePrompt) {
      const medRes = await fetch(
        `${SUPABASE_URL}/rest/v1/meditations?id=eq.${meditationId}&select=pending_image_prompt,meditation_artwork_url`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      );
      const rows = await medRes.json();
      if (!Array.isArray(rows) || !rows[0]) throw new Error("meditation not found");
      if (rows[0].meditation_artwork_url) {
        return new Response(JSON.stringify({ artworkUrl: rows[0].meditation_artwork_url, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      imagePrompt = rows[0].pending_image_prompt;
    }
    if (!imagePrompt) throw new Error("no image prompt available");

    // Generate via Lovable AI Gateway (Nano Banana)
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiRes.text();
      console.error("Image gen error:", aiRes.status, t);
      throw new Error(`Image generation failed: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const dataUrl: string | undefined = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl?.startsWith("data:")) throw new Error("no image returned");

    // Convert data URL to bytes
    const commaIdx = dataUrl.indexOf(",");
    const meta = dataUrl.slice(5, commaIdx); // e.g. image/png;base64
    const mime = meta.split(";")[0] || "image/png";
    const ext = mime.split("/")[1] || "png";
    const base64 = dataUrl.slice(commaIdx + 1);
    const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // Upload to storage
    const path = `${meditationId}/${crypto.randomUUID()}.${ext}`;
    const upRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/meditation-artwork/${path}`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": mime,
          "x-upsert": "true",
        },
        body: bin,
      },
    );
    if (!upRes.ok) {
      const t = await upRes.text();
      throw new Error(`Upload failed: ${upRes.status} ${t}`);
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/meditation-artwork/${path}`;

    // Patch meditation row
    await fetch(`${SUPABASE_URL}/rest/v1/meditations?id=eq.${meditationId}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        meditation_artwork_url: publicUrl,
        pending_image_prompt: null,
      }),
    });

    return new Response(JSON.stringify({ artworkUrl: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-meditation-artwork error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
