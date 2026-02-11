import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TranslateItem {
  table: string;
  id: string;
  field: string;
  text: string;
  source_lang: string;
}

interface TranslateRequest {
  // Phase 0 legacy
  items?: TranslateItem[];
  // Phase 1 meaning-based
  meaning_object_ids?: string[];
  target_lang: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as TranslateRequest;
    const { target_lang } = body;

    if (!target_lang) {
      return new Response(JSON.stringify({ error: "Missing target_lang" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ─── Phase 1: Meaning-based translation ───
    if (body.meaning_object_ids && body.meaning_object_ids.length > 0) {
      return await handleMeaningTranslation(
        supabase, body.meaning_object_ids, target_lang, LOVABLE_API_KEY
      );
    }

    // ─── Phase 0: Legacy text-based translation ───
    if (body.items && body.items.length > 0) {
      return await handleLegacyTranslation(
        supabase, body.items, target_lang, LOVABLE_API_KEY
      );
    }

    return new Response(JSON.stringify({ error: "No items or meaning_object_ids provided" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ull-translate error:", error);
    return new Response(JSON.stringify({
      error: "An error occurred processing your request",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Phase 1: Meaning → Language Projection ───
async function handleMeaningTranslation(
  supabase: any,
  meaningIds: string[],
  targetLang: string,
  apiKey: string
) {
  const results: Record<string, string> = {};
  const cacheMisses: { id: string; meaningJson: any; sourceLang: string }[] = [];

  // Check cache first
  for (const mId of meaningIds) {
    const { data: cached } = await supabase
      .from("content_translations")
      .select("translated_text")
      .eq("meaning_object_id", mId)
      .eq("target_lang", targetLang)
      .eq("field", "content")
      .maybeSingle();

    if (cached?.translated_text) {
      results[mId] = cached.translated_text;
    } else {
      // Fetch meaning_json
      const { data: mo } = await supabase
        .from("meaning_objects")
        .select("meaning_json, source_lang")
        .eq("id", mId)
        .single();

      if (mo) {
        if (mo.source_lang === targetLang) {
          // Same language — use subject as-is
          results[mId] = mo.meaning_json?.subject || "";
        } else {
          cacheMisses.push({ id: mId, meaningJson: mo.meaning_json, sourceLang: mo.source_lang });
        }
      }
    }
  }

  if (cacheMisses.length === 0) {
    return new Response(JSON.stringify({ translations: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Project meaning → language via AI
  // IMPORTANT: Only use the English 'subject' field for translation.
  // The 'description' field may be in a different language and confuses the model.
  const textsToTranslate = cacheMisses.map((item, i) => {
    const mj = item.meaningJson;
    return `[${i}] ${mj.subject || mj.description || ''}`;
  }).join("\n");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a precise translator. Translate each numbered English text into ${targetLang}.
CRITICAL RULES:
- Output MUST be in ${targetLang} language ONLY. Never output in any other language.
- Return ONLY a JSON array of translated strings in the same order.
- Keep translations concise — short phrases, not full sentences.
- Preserve business terminology exactly.
- Do NOT add explanations or extra text.

Example (translating to Arabic):
Input:
[0] Create marketing plan
[1] Review Q3 budget

Output:
["إنشاء خطة تسويقية", "مراجعة ميزانية الربع الثالث"]`,
        },
        { role: "user", content: textsToTranslate },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new Error("Translation service error");
  }

  const aiResult = await response.json();
  const rawContent = aiResult.choices?.[0]?.message?.content || "[]";

  let translations: string[];
  try {
    const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
    translations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    console.error("Failed to parse AI meaning projection:", rawContent);
    for (const item of cacheMisses) {
      results[item.id] = item.meaningJson?.subject || "";
    }
    return new Response(JSON.stringify({ translations: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Store in cache and results
  for (let i = 0; i < cacheMisses.length; i++) {
    const item = cacheMisses[i];
    const translatedText = translations[i] || item.meaningJson?.subject || "";
    results[item.id] = translatedText;

    // Cache in content_translations (best-effort, ignore errors)
    const { error: cacheError } = await supabase.from("content_translations").upsert({
      meaning_object_id: item.id,
      target_lang: targetLang,
      field: "content",
      translated_text: translatedText,
    }, { onConflict: "meaning_object_id,target_lang,field" });
    if (cacheError) {
      console.warn("Cache upsert failed:", cacheError.message);
    }
  }

  return new Response(JSON.stringify({ translations: results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Phase 0: Legacy text-based translation ───
async function handleLegacyTranslation(
  supabase: any,
  items: TranslateItem[],
  targetLang: string,
  apiKey: string
) {
  const results: Record<string, string> = {};
  const cacheMisses: TranslateItem[] = [];

  for (const item of items) {
    if (item.source_lang === targetLang) {
      results[`${item.table}:${item.id}:${item.field}`] = item.text;
      continue;
    }
    cacheMisses.push(item);
  }

  if (cacheMisses.length === 0) {
    return new Response(JSON.stringify({ translations: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const textsToTranslate = cacheMisses.map((item, i) =>
    `[${i}] ${item.text}`
  ).join("\n");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a precise translator. Translate each numbered text into ${targetLang}.
CRITICAL RULES:
- Output MUST be in ${targetLang} language ONLY. Never output in any other language.
- Return ONLY a JSON array of translated strings in the same order.
- Keep translations concise — short phrases, not full sentences.
- Preserve business terminology exactly.
- Do NOT add explanations or extra text.

Example (translating to Arabic):
Input:
[0] Create marketing plan
[1] Review Q3 budget

Output:
["إنشاء خطة تسويقية", "مراجعة ميزانية الربع الثالث"]`,
        },
        { role: "user", content: textsToTranslate },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new Error("Translation service error");
  }

  const aiResult = await response.json();
  const rawContent = aiResult.choices?.[0]?.message?.content || "[]";

  let translations: string[];
  try {
    const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
    translations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    console.error("Failed to parse AI translation response:", rawContent);
    for (const item of cacheMisses) {
      results[`${item.table}:${item.id}:${item.field}`] = item.text;
    }
    return new Response(JSON.stringify({ translations: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (let i = 0; i < cacheMisses.length; i++) {
    const item = cacheMisses[i];
    const key = `${item.table}:${item.id}:${item.field}`;
    results[key] = translations[i] || item.text;
  }

  return new Response(JSON.stringify({ translations: results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
