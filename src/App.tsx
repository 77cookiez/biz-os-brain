import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import { OSLayout } from "@/components/OSLayout";
import AuthPage from "@/pages/AuthPage";
import OnboardingPage from "@/pages/OnboardingPage";
import TodayPage from "@/pages/brain/TodayPage";
import BusinessSetupPage from "@/pages/brain/BusinessSetupPage";
import GoalsPage from "@/pages/brain/GoalsPage";
import TeamTasksPage from "@/pages/brain/TeamTasksPage";
import WeeklyCheckinPage from "@/pages/brain/WeeklyCheckinPage";
import Marketplace from "@/pages/Marketplace";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();

  if (loading || workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!currentWorkspace) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();

  if (loading || workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && currentWorkspace) {
    return <Navigate to="/" replace />;
  }

  if (user && !currentWorkspace) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();

  if (loading || workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (currentWorkspace) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route
      path="/auth"
      element={
        <AuthRoute>
          <AuthPage />
        </AuthRoute>
      }
    />
    <Route
      path="/onboarding"
      element={
        <OnboardingRoute>
          <OnboardingPage />
        </OnboardingRoute>
      }
    />
    <Route
      element={
        <ProtectedRoute>
          <OSLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/" element={<TodayPage />} />
      <Route path="/brain/setup" element={<BusinessSetupPage />} />
      <Route path="/brain/goals" element={<GoalsPage />} />
      <Route path="/brain/tasks" element={<TeamTasksPage />} />
      <Route path="/brain/checkin" element={<WeeklyCheckinPage />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <AppRoutes />
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
