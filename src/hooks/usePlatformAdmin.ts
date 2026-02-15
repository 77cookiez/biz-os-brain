import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const FUNC = "platform-admin";

async function callPlatform(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error("Not authenticated");

  const url = new URL(
    `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/${FUNC}/${path}`
  );
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─── Existing hooks ───

export function usePlatformRole() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["platform-role", user?.id],
    queryFn: () => callPlatform("GET", "role"),
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useBootstrapOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callPlatform("POST", "bootstrap"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-role"] }),
  });
}

export function usePlatformWorkspaces(search: string) {
  return useQuery({
    queryKey: ["platform-workspaces", search],
    queryFn: () =>
      callPlatform("GET", "workspaces", undefined, { search, limit: "30" }),
    enabled: true,
  });
}

export function usePlatformGrants(scope?: string) {
  return useQuery({
    queryKey: ["platform-grants", scope],
    queryFn: () =>
      callPlatform("GET", "grants", undefined, scope ? { scope } : {}),
  });
}

export function useCreateGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      scope: string;
      scope_id: string;
      grant_type: string;
      reason: string;
      ends_at?: string;
    }) => callPlatform("POST", "grants", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-grants"] }),
  });
}

export function useRevokeGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { grant_id: string; reason: string }) =>
      callPlatform("POST", "revoke-grant", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-grants"] }),
  });
}

export function usePlatformAudit(actionType?: string) {
  return useQuery({
    queryKey: ["platform-audit", actionType],
    queryFn: () =>
      callPlatform(
        "GET",
        "audit",
        undefined,
        actionType ? { action_type: actionType } : {}
      ),
  });
}

// ─── NEW hooks ───

export function useWorkspaceDetail(workspaceId: string | null) {
  return useQuery({
    queryKey: ["platform-workspace-detail", workspaceId],
    queryFn: () =>
      callPlatform("GET", "workspace-detail", undefined, {
        workspace_id: workspaceId!,
      }),
    enabled: !!workspaceId,
  });
}

export function useAvailableApps() {
  return useQuery({
    queryKey: ["platform-available-apps"],
    queryFn: () => callPlatform("GET", "available-apps"),
    staleTime: 5 * 60_000,
  });
}

export function useSetOsPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      workspace_id: string;
      plan_id: string;
      billing_cycle?: string;
      reason: string;
    }) => callPlatform("POST", "set-os-plan", body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["platform-workspace-detail", vars.workspace_id] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
      qc.invalidateQueries({ queryKey: ["platform-grants"] });
    },
  });
}

export function useSetAppSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      workspace_id: string;
      app_id: string;
      plan: string;
      status?: string;
      expires_at?: string;
      reason: string;
    }) => callPlatform("POST", "set-app-subscription", body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["platform-workspace-detail", vars.workspace_id] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
      qc.invalidateQueries({ queryKey: ["platform-grants"] });
    },
  });
}

export function useInstallApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      workspace_id: string;
      app_id: string;
      reason: string;
    }) => callPlatform("POST", "install-app", body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["platform-workspace-detail", vars.workspace_id] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
    },
  });
}

export function useUninstallApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      workspace_id: string;
      app_id: string;
      reason: string;
    }) => callPlatform("POST", "uninstall-app", body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["platform-workspace-detail", vars.workspace_id] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
    },
  });
}
