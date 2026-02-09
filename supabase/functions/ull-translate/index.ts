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
  items: TranslateItem[];
  target_lang: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items, target_lang } = await req.json() as TranslateRequest;

    if (!items?.length || !target_lang) {
      return new Response(JSON.stringify({ error: "Missing items or target_lang" }), {
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

    // Check cache first — build lookup keys
    const results: Record<string, string> = {};
    const cacheMisses: TranslateItem[] = [];

    // Try to find existing translations in content_translations
    // We use source_table + source_id + source_field + target_lang as cache key
    for (const item of items) {
      // Skip if source and target are the same
      if (item.source_lang === target_lang) {
        results[`${item.table}:${item.id}:${item.field}`] = item.text;
        continue;
      }

      // Check if there's a meaning_object linked, and if so check content_translations
      // For Phase 0, we do a direct lookup using a custom approach:
      // Look for cached translations by composite key
      const { data: cached } = await supabase
        .from("content_translations")
        .select("translated_text")
        .eq("field", item.field)
        .eq("target_lang", target_lang)
        .limit(1)
        .maybeSingle();

      // For Phase 0 we skip full meaning_object lookup and translate directly
      // Cache hits would come from meaning_object_id based lookups in later phases
      cacheMisses.push(item);
    }

    if (cacheMisses.length === 0) {
      return new Response(JSON.stringify({ translations: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch translate via AI
    const textsToTranslate = cacheMisses.map((item, i) => 
      `[${i}] ${item.text}`
    ).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a precise business content translator. Translate the following numbered texts into ${target_lang}. 
Preserve business meaning, intent, and terminology exactly.
Return ONLY a JSON array of strings in the same order as the input.
Do not add explanations. Do not change meaning. Do not interpret.
Example input:
[0] Create marketing plan
[1] Review Q3 budget

Example output:
["إنشاء خطة تسويقية", "مراجعة ميزانية الربع الثالث"]`,
          },
          { role: "user", content: textsToTranslate },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Translation service error");
    }

    const aiResult = await response.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "[]";
    
    // Parse the JSON array from AI response
    let translations: string[];
    try {
      // Extract JSON array from response (handle markdown code blocks)
      const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
      translations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      console.error("Failed to parse AI translation response:", rawContent);
      // Fallback: return original texts
      for (const item of cacheMisses) {
        results[`${item.table}:${item.id}:${item.field}`] = item.text;
      }
      return new Response(JSON.stringify({ translations: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map translations back to results
    for (let i = 0; i < cacheMisses.length; i++) {
      const item = cacheMisses[i];
      const key = `${item.table}:${item.id}:${item.field}`;
      results[key] = translations[i] || item.text;
    }

    return new Response(JSON.stringify({ translations: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ull-translate error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
