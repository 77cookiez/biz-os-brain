import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface Company {
  id: string;
  name: string;
  created_by: string;
}

interface Workspace {
  id: string;
  company_id: string;
  name: string;
  default_locale: string;
}

type BusinessType = 'trade' | 'services' | 'factory' | 'online' | 'retail' | 'consulting' | 'other';

interface BusinessContext {
  id: string;
  workspace_id: string;
  business_type: BusinessType | null;
  business_description: string | null;
  primary_pain: string | null;
  secondary_pains: string[] | null;
  team_size: string | null;
  has_team: boolean;
  ninety_day_focus: string[] | null;
  setup_completed: boolean;
}

interface BusinessContextUpdate {
  business_type?: BusinessType | null;
  business_description?: string | null;
  primary_pain?: string | null;
  secondary_pains?: string[] | null;
  team_size?: string | null;
  has_team?: boolean;
  ninety_day_focus?: string[] | null;
  setup_completed?: boolean;
}

interface InstalledApp {
  app_id: string;
  is_active: boolean;
}

interface WorkspaceContextType {
  companies: Company[];
  workspaces: Workspace[];
  currentCompany: Company | null;
  currentWorkspace: Workspace | null;
  businessContext: BusinessContext | null;
  installedApps: InstalledApp[];
  loading: boolean;
  setCurrentCompany: (company: Company) => void;
  setCurrentWorkspace: (workspace: Workspace) => void;
  createCompanyAndWorkspace: (companyName: string, workspaceName: string) => Promise<{ company: Company; workspace: Workspace } | null>;
  updateBusinessContext: (updates: BusinessContextUpdate) => Promise<void>;
  refreshBusinessContext: () => Promise<void>;
  refreshInstalledApps: () => Promise<void>;
  activateApp: (appId: string) => Promise<void>;
  deactivateApp: (appId: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [businessContext, setBusinessContext] = useState<BusinessContext | null>(null);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch companies and workspaces when user changes
  useEffect(() => {
    if (!user) {
      setCompanies([]);
      setWorkspaces([]);
      setCurrentCompany(null);
      setCurrentWorkspace(null);
      setBusinessContext(null);
      setInstalledApps([]);
      setLoading(false);
      return;
    }

    fetchData();
  }, [user]);

  // Fetch business context when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      refreshBusinessContext();
      refreshInstalledApps();
    }
  }, [currentWorkspace?.id]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch companies
      const { data: companiesData } = await supabase
        .from('companies')
        .select('*')
        .order('created_at');
      
      setCompanies(companiesData || []);

      if (companiesData && companiesData.length > 0) {
        const company = companiesData[0];
        setCurrentCompany(company);

        // Fetch workspaces for this company
        const { data: workspacesData } = await supabase
          .from('workspaces')
          .select('*')
          .eq('company_id', company.id)
          .order('created_at');
        
        setWorkspaces(workspacesData || []);
        
        if (workspacesData && workspacesData.length > 0) {
          setCurrentWorkspace(workspacesData[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching workspace data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshBusinessContext = async () => {
    if (!currentWorkspace) return;

    const { data } = await supabase
      .from('business_contexts')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .single();
    
    setBusinessContext(data);
  };

  const refreshInstalledApps = async () => {
    if (!currentWorkspace) return;

    const { data } = await supabase
      .from('workspace_apps')
      .select('app_id, is_active')
      .eq('workspace_id', currentWorkspace.id);
    
    setInstalledApps(data || []);
  };

  const createCompanyAndWorkspace = async (companyName: string, workspaceName: string) => {
    if (!user) return null;

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('onboarding-create', {
        body: {
          companyName,
          workspaceName,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) throw error;

      const company = (data as any)?.company as Company | undefined;
      const workspace = (data as any)?.workspace as Workspace | undefined;

      if (!company || !workspace) {
        throw new Error('Invalid onboarding response');
      }

      // Update state
      setCompanies((prev) => [...prev, company]);
      setWorkspaces((prev) => [...prev, workspace]);
      setCurrentCompany(company);
      setCurrentWorkspace(workspace);

      return { company, workspace };
    } catch (error) {
      console.error('Error creating company/workspace:', error);
      return null;
    }
  };

  const updateBusinessContext = async (updates: BusinessContextUpdate) => {
    if (!currentWorkspace) return;

    // Check if context exists
    const { data: existing } = await supabase
      .from('business_contexts')
      .select('id')
      .eq('workspace_id', currentWorkspace.id)
      .single();

    let data;
    if (existing) {
      const result = await supabase
        .from('business_contexts')
        .update(updates as any)
        .eq('workspace_id', currentWorkspace.id)
        .select()
        .single();
      data = result.data;
    } else {
      const result = await supabase
        .from('business_contexts')
        .insert({
          workspace_id: currentWorkspace.id,
          ...updates
        } as any)
        .select()
        .single();
      data = result.data;
    }
    
    if (data) setBusinessContext(data);
  };

  const activateApp = async (appId: string) => {
    if (!currentWorkspace || !user) return;

    await supabase.from('workspace_apps').upsert({
      workspace_id: currentWorkspace.id,
      app_id: appId,
      is_active: true,
      installed_by: user.id
    }, { onConflict: 'workspace_id,app_id' });

    refreshInstalledApps();
  };

  const deactivateApp = async (appId: string) => {
    if (!currentWorkspace) return;

    await supabase
      .from('workspace_apps')
      .update({ is_active: false })
      .eq('workspace_id', currentWorkspace.id)
      .eq('app_id', appId);

    refreshInstalledApps();
  };

  return (
    <WorkspaceContext.Provider value={{
      companies,
      workspaces,
      currentCompany,
      currentWorkspace,
      businessContext,
      installedApps,
      loading,
      setCurrentCompany,
      setCurrentWorkspace,
      createCompanyAndWorkspace,
      updateBusinessContext,
      refreshBusinessContext,
      refreshInstalledApps,
      activateApp,
      deactivateApp
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
