/**
 * Booking Diagnostics Panel
 *
 * ADMIN + DEV ONLY
 * Shows: tenantSlug, workspace_id, user role, last 5 audit_logs, last 5 org_events.
 * Visible only if (user is admin/owner) AND (env is dev OR feature flag).
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getUserBookingRoles, type UserRoleInfo } from '@/lib/booking/roleHelper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

const IS_DEV = import.meta.env.DEV;

interface DiagnosticsPanelProps {
  tenantSlug: string;
  workspaceId: string;
}

export function DiagnosticsPanel({ tenantSlug, workspaceId }: DiagnosticsPanelProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Check role first
  const { data: roleInfo } = useQuery({
    queryKey: ['booking-diagnostics-role', workspaceId, user?.id],
    queryFn: () => getUserBookingRoles(workspaceId, user!.id),
    enabled: !!workspaceId && !!user,
  });

  const isAdminOrOwner = roleInfo?.roles.includes('admin') || roleInfo?.roles.includes('owner');

  // Only show in dev + admin
  if (!IS_DEV || !isAdminOrOwner) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="fixed bottom-4 right-4 z-[9999]">
        <CollapsibleTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs bg-card/95 backdrop-blur-sm border-border shadow-lg"
          >
            <Bug className="h-3.5 w-3.5" />
            Diagnostics
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <DiagnosticsContent
            tenantSlug={tenantSlug}
            workspaceId={workspaceId}
            roleInfo={roleInfo!}
          />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function DiagnosticsContent({
  tenantSlug,
  workspaceId,
  roleInfo,
}: {
  tenantSlug: string;
  workspaceId: string;
  roleInfo: UserRoleInfo;
}) {
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['booking-diag-audit', workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('id, action, entity_type, entity_id, created_at, actor_user_id')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const { data: orgEvents = [] } = useQuery({
    queryKey: ['booking-diag-org-events', workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('org_events')
        .select('id, event_type, object_type, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  return (
    <Card className="w-96 mt-2 shadow-xl border-border bg-card text-xs">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bug className="h-4 w-4" />
          Booking Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Tenant Info */}
        <div className="space-y-1">
          <p className="font-medium text-muted-foreground">Tenant</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px]">slug: {tenantSlug}</Badge>
            <Badge variant="outline" className="text-[10px] font-mono">ws: {workspaceId.slice(0, 8)}…</Badge>
          </div>
        </div>

        {/* User Role */}
        <div className="space-y-1">
          <p className="font-medium text-muted-foreground">User Roles</p>
          <div className="flex flex-wrap gap-1">
            {roleInfo.roles.map(r => (
              <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
            ))}
            {roleInfo.vendorId && (
              <Badge variant="outline" className="text-[10px]">
                vendor: {roleInfo.vendorStatus} ({roleInfo.vendorId.slice(0, 8)}…)
              </Badge>
            )}
          </div>
        </div>

        {/* Audit Logs */}
        <div className="space-y-1">
          <p className="font-medium text-muted-foreground">Last 5 Audit Logs</p>
          {auditLogs.length === 0 ? (
            <p className="text-muted-foreground italic">None</p>
          ) : (
            <div className="space-y-0.5">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-[10px]">
                  <span className="font-mono text-foreground truncate max-w-[200px]">{log.action}</span>
                  <span className="text-muted-foreground shrink-0">
                    {format(new Date(log.created_at), 'HH:mm:ss')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Org Events */}
        <div className="space-y-1">
          <p className="font-medium text-muted-foreground">Last 5 Org Events</p>
          {orgEvents.length === 0 ? (
            <p className="text-muted-foreground italic">None</p>
          ) : (
            <div className="space-y-0.5">
              {orgEvents.map((evt: any) => (
                <div key={evt.id} className="flex items-center justify-between text-[10px]">
                  <span className="font-mono text-foreground truncate max-w-[200px]">{evt.event_type}</span>
                  <span className="text-muted-foreground shrink-0">
                    {format(new Date(evt.created_at), 'HH:mm:ss')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
