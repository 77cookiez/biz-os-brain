import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { BrainCommandProvider } from "@/contexts/BrainCommandContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "@/i18n";
import { OSLayout } from "@/components/OSLayout";
import AuthPage from "@/pages/AuthPage";
import OnboardingPage from "@/pages/OnboardingPage";
import TodayPage from "@/pages/brain/TodayPage";
import BrainPage from "@/pages/brain/BrainPage";
import InsightsPage from "@/pages/InsightsPage";
import DigestArchivePage from "@/pages/insights/DigestArchivePage";
import BusinessSetupPage from "@/pages/brain/BusinessSetupPage";
import TeamTasksPage from "@/pages/brain/TeamTasksPage";
import WeeklyCheckinPage from "@/pages/brain/WeeklyCheckinPage";
import Marketplace from "@/pages/Marketplace";
import SettingsPage from "@/pages/SettingsPage";
import CompanySettingsPage from "@/pages/settings/CompanySettingsPage";
import AccountSettingsPage from "@/pages/settings/AccountSettingsPage";
import WorkspacesSettingsPage from "@/pages/settings/WorkspacesSettingsPage";
import TeamRolesSettingsPage from "@/pages/settings/TeamRolesSettingsPage";
import LanguageSettingsPage from "@/pages/settings/LanguageSettingsPage";
import NotificationsSettingsPage from "@/pages/settings/NotificationsSettingsPage";
import AppearanceSettingsPage from "@/pages/settings/AppearanceSettingsPage";
import AppsSettingsPage from "@/pages/settings/AppsSettingsPage";
import IntelligenceSettingsPage from "@/pages/settings/IntelligenceSettingsPage";
import WorkspaceLanguageSettingsPage from "@/pages/settings/WorkspaceLanguageSettingsPage";
import ULLDeveloperContractPage from "@/pages/docs/ULLDeveloperContractPage";
import NotFound from "./pages/NotFound";
import WorkboardLayout from "@/pages/workboard/WorkboardLayout";
import UnifiedTasksPage from "@/pages/workboard/UnifiedTasksPage";
import WorkboardGoalsPage from "@/pages/workboard/WorkboardGoalsPage";
import WorkboardCalendarPage from "@/pages/workboard/WorkboardCalendarPage";
import WorkboardBrainstormPage from "@/pages/workboard/WorkboardBrainstormPage";
import ChatPage from "@/pages/chat/ChatPage";
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
      <Route path="/insights" element={<InsightsPage />} />
      <Route path="/insights/archive" element={<DigestArchivePage />} />
      <Route path="/brain" element={<BrainPage />} />
      <Route path="/brain/setup" element={<BusinessSetupPage />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/account" element={<AccountSettingsPage />} />
      <Route path="/settings/company" element={<CompanySettingsPage />} />
      <Route path="/settings/workspaces" element={<WorkspacesSettingsPage />} />
      <Route path="/settings/team" element={<TeamRolesSettingsPage />} />
      <Route path="/settings/language" element={<LanguageSettingsPage />} />
      <Route path="/settings/notifications" element={<NotificationsSettingsPage />} />
      <Route path="/settings/appearance" element={<AppearanceSettingsPage />} />
      <Route path="/settings/apps" element={<AppsSettingsPage />} />
      <Route path="/settings/intelligence" element={<IntelligenceSettingsPage />} />
      <Route path="/settings/workspace/language" element={<WorkspaceLanguageSettingsPage />} />
      <Route path="/docs/system/ull" element={<ULLDeveloperContractPage />} />
      <Route path="/apps/workboard" element={<WorkboardLayout />}>
        <Route index element={<UnifiedTasksPage />} />
        <Route path="goals" element={<WorkboardGoalsPage />} />
        <Route path="calendar" element={<WorkboardCalendarPage />} />
        <Route path="checkin" element={<WeeklyCheckinPage />} />
        <Route path="brainstorm" element={<WorkboardBrainstormPage />} />
        {/* Redirects for old routes */}
        <Route path="week" element={<Navigate to="/apps/workboard" replace />} />
        <Route path="backlog" element={<Navigate to="/apps/workboard" replace />} />
        <Route path="tasks" element={<Navigate to="/apps/workboard" replace />} />
      </Route>
      <Route path="/apps/chat" element={<ChatPage />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <WorkspaceProvider>
                <LanguageProvider>
                  <BrainCommandProvider>
                    <ErrorBoundary>
                      <AppRoutes />
                    </ErrorBoundary>
                  </BrainCommandProvider>
                </LanguageProvider>
              </WorkspaceProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
