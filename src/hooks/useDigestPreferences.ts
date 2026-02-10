import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

interface DigestPreferences {
  enabled: boolean;
  in_app: boolean;
  email: boolean;
}

const DEFAULTS: DigestPreferences = {
  enabled: true,
  in_app: true,
  email: true,
};

export function useDigestPreferences() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<DigestPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace?.id || !user?.id) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from('digest_preferences')
        .select('enabled, in_app, email')
        .eq('user_id', user.id)
        .eq('workspace_id', currentWorkspace.id)
        .maybeSingle();

      if (data) {
        setPrefs({
          enabled: data.enabled ?? true,
          in_app: data.in_app ?? true,
          email: data.email ?? true,
        });
      }
      setLoading(false);
    };

    load();
  }, [currentWorkspace?.id, user?.id]);

  const updatePrefs = useCallback(
    async (updates: Partial<DigestPreferences>) => {
      if (!currentWorkspace?.id || !user?.id) return;

      const newPrefs = { ...prefs, ...updates };
      setPrefs(newPrefs);

      const { error } = await supabase
        .from('digest_preferences')
        .upsert(
          {
            user_id: user.id,
            workspace_id: currentWorkspace.id,
            ...newPrefs,
          } as any,
          { onConflict: 'user_id,workspace_id' }
        );

      if (error) {
        console.error('Failed to save digest preferences:', error);
        // Revert
        setPrefs(prefs);
      }
    },
    [prefs, currentWorkspace?.id, user?.id]
  );

  return { prefs, loading, updatePrefs };
}
