import { Navigate } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Loader2 } from 'lucide-react';

interface AppInstalledGateProps {
  appId: string;
  children: React.ReactNode;
  /** Where to redirect if not installed */
  fallbackPath?: string;
}

/**
 * Route guard that only renders children if the app is installed & active
 * in the current workspace. Redirects to marketplace listing otherwise.
 */
export function AppInstalledGate({ appId, children, fallbackPath }: AppInstalledGateProps) {
  const { installedApps, loading } = useWorkspace();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const app = installedApps.find(a => a.app_id === appId);
  const isInstalled = app?.is_active === true;

  if (!isInstalled) {
    return <Navigate to={fallbackPath ?? `/marketplace?highlight=${appId}`} replace />;
  }

  return <>{children}</>;
}
