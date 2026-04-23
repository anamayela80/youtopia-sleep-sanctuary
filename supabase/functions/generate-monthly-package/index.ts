import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the insight engine behind Youtopia. Based on a user's onboarding answers and their monthly theme, you generate three things in a single response as JSON:

1. meditation_name: A poetic, personal title for this month's meditation. 4–7 words. Drawn directly from the user's answers — a specific image, phrase, or metaphor they used. Not generic. Examples: "She Who Carried It All the Way Home", "The Echo of the Closet Door", "Opening the Window to Scotland". Never use the theme name as the title.

2. message_for_you: A personal, reflective message of 200–280 words. Written directly to the user by name. References specific things they shared — including names of people they mentioned. Not therapy, not advice. Structured as: one paragraph of genuine observation ("I can see that..."), one paragraph of reflective questions ("What if..."), one closing line in italics that plants a quiet truth. Tone: warm, grounded, never sentimental. No exclamation marks. No wellness clichés.

3. image_prompt: A prompt for an AI image generator to create the meditation artwork. Style: warm modern abstract art, brand colors (cream #F5F0E8, teal #6BBFAA, coral #E07B6A, olive gold #8B7035). No people, no faces, no text. Evokes the emotional territory of this month's theme and the user's specific answers. Painterly, textured, intimate. 50–80 words.

Return ONLY valid JSON in this exact format, nothing else:
{
  "meditation_name": "...",
  "message_for_you": "...",
  "image_prompt": "..."
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { meditationId, userName, monthlyTheme, themeIntention, answers } = await req.json();

    if (!Array.isArray(answers) || answers.length < 1) {
      return new Response(JSON.stringify({ error: "answers array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const answersBlock = answers
      .map((a: string, i: number) => `- answer_${i + 1}: "${a}"`)
      .join("\n");

    const userPrompt = `USER CONTEXT:
- user_name: ${userName || "(not provided — address them warmly without inventing a name)"}
- monthly_theme: ${monthlyTheme || "(no specific theme — let answers lead)"}
- theme_intention: ${themeIntention || "(none)"}
${answersBlock}

Return the JSON now.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      throw new Error(`Failed to generate monthly package (${response.status})`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    // Strip code fences if present
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error("No JSON in response. Raw:", raw);
      throw new Error("No JSON found in response");
    }

    let parsed: { meditation_name?: string; message_for_you?: string; image_prompt?: string };
    try {
      parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
    } catch (e) {
      console.error("JSON parse error:", e, "raw:", raw);
      throw new Error("Could not parse AI response as JSON");
    }

    const meditationName = parsed.meditation_name?.trim() || null;
    const messageForYou = parsed.message_for_you?.trim() || null;
    const imagePrompt = parsed.image_prompt?.trim() || null;

    console.log("Generated package:", { meditationId, hasName: !!meditationName, msgLen: messageForYou?.length, hasPrompt: !!imagePrompt });

    // Persist to meditations row if meditationId provided
    if (meditationId) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/meditations?id=eq.${meditationId}`, {
        method: "PATCH",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          meditation_name: meditationName,
          message_for_you: messageForYou,
          pending_image_prompt: imagePrompt,
        }),
      });
      if (!updateRes.ok) {
        console.error("Failed to update meditation:", await updateRes.text());
      }
    }

    return new Response(
      JSON.stringify({
        meditationName,
        messageForYou,
        imagePrompt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-monthly-package error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
