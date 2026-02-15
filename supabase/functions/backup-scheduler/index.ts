import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-maintenance-key",
};

function structuredLog(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), function: "backup-scheduler", ...fields }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    // Auth: maintenance key
    const maintenanceKey = Deno.env.get("MAINTENANCE_KEY");
    const providedKey = req.headers.get("x-maintenance-key") || "";
    if (!maintenanceKey || providedKey !== maintenanceKey) {
      return new Response(
        JSON.stringify({ ok: false, code: "UNAUTHORIZED", request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Find all workspaces with backups enabled
    const { data: settings, error: settingsErr } = await sb
      .from("workspace_backup_settings")
      .select("workspace_id, retain_count, store_in_storage")
      .eq("is_enabled", true);

    if (settingsErr) {
      structuredLog({ error: settingsErr.message, request_id: requestId });
      return new Response(
        JSON.stringify({ ok: false, code: "DB_ERROR", request_id: requestId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Array<{ workspace_id: string; snapshot_id?: string; error?: string }> = [];

    for (const setting of (settings || [])) {
      try {
        // Find a workspace admin to use as actor
        const { data: admin } = await sb
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", setting.workspace_id)
          .eq("team_role", "owner")
          .limit(1)
          .single();

        if (!admin) {
          results.push({ workspace_id: setting.workspace_id, error: "No admin found" });
          continue;
        }

        // Create snapshot
        const { data: snapId, error: snapErr } = await sb.rpc("create_workspace_snapshot", {
          _workspace_id: setting.workspace_id,
          _actor: admin.user_id,
          _snapshot_type: "scheduled",
        });

        if (snapErr) {
          results.push({ workspace_id: setting.workspace_id, error: snapErr.message });
          continue;
        }

        // Upload to storage if enabled
        if (setting.store_in_storage && snapId) {
          const { data: snap } = await sb
            .from("workspace_snapshots")
            .select("snapshot_json")
            .eq("id", snapId)
            .single();

          if (snap) {
            const jsonStr = JSON.stringify(snap.snapshot_json);
            const storagePath = `${setting.workspace_id}/${snapId}.json`;

            const { error: uploadErr } = await sb.storage
              .from("workspace-backups")
              .upload(storagePath, new Blob([jsonStr], { type: "application/json" }), {
                contentType: "application/json",
                upsert: false,
              });

            if (!uploadErr) {
              // Update snapshot with storage info
              const encoder = new TextEncoder();
              const data = encoder.encode(jsonStr);
              const hashBuffer = await crypto.subtle.digest("SHA-256", data);
              const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

              await sb
                .from("workspace_snapshots")
                .update({
                  storage_path: storagePath,
                  size_bytes: jsonStr.length,
                  checksum: hashHex,
                })
                .eq("id", snapId);
            }
          }
        }

        // Enforce retention: delete old snapshots
        const { data: allSnaps } = await sb
          .from("workspace_snapshots")
          .select("id, storage_path")
          .eq("workspace_id", setting.workspace_id)
          .order("created_at", { ascending: false });

        if (allSnaps && allSnaps.length > setting.retain_count) {
          const toDelete = allSnaps.slice(setting.retain_count);
          for (const old of toDelete) {
            if (old.storage_path) {
              await sb.storage.from("workspace-backups").remove([old.storage_path]);
            }
            await sb.from("workspace_snapshots").delete().eq("id", old.id);
          }
        }

        results.push({ workspace_id: setting.workspace_id, snapshot_id: snapId });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ workspace_id: setting.workspace_id, error: msg });
      }
    }

    structuredLog({ status_code: 200, request_id: requestId, processed: results.length });

    return new Response(
      JSON.stringify({ ok: true, results, request_id: requestId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    structuredLog({ status_code: 500, error: String(error), request_id: requestId });
    return new Response(
      JSON.stringify({ ok: false, code: "INTERNAL_ERROR", request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
