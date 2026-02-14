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
import BookivoPage from "@/pages/BookivoPage";
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
import RiskDashboardPage from "@/pages/enterprise/RiskDashboardPage";
import LeadershipPage from "@/pages/apps/leadership/LeadershipPage";
import LeadershipSettingsPage from "@/pages/apps/leadership/LeadershipSettingsPage";
import BookingLayout from "@/pages/apps/booking/BookingLayout";
import BookingDashboard from "@/pages/apps/booking/BookingDashboard";
import BookingVendorsPage from "@/pages/apps/booking/BookingVendorsPage";
import BookingServicesPage from "@/pages/apps/booking/BookingServicesPage";
import BookingCalendarPage from "@/pages/apps/booking/BookingCalendarPage";
import BookingQuotesPage from "@/pages/apps/booking/BookingQuotesPage";
import BookingBookingsPage from "@/pages/apps/booking/BookingBookingsPage";
import BookingSettingsPage from "@/pages/apps/booking/BookingSettingsPage";
import BillingPage from "@/pages/apps/booking/BillingPage";
import { AppInstalledGate } from "@/components/apps/AppInstalledGate";
import PublicBookingLayout from "@/pages/public/booking/PublicBookingLayout";
import PublicBrowsePage from "@/pages/public/booking/PublicBrowsePage";
import PublicVendorDetailPage from "@/pages/public/booking/PublicVendorDetailPage";
import PublicRequestQuotePage from "@/pages/public/booking/PublicRequestQuotePage";
import PublicMyBookingsPage from "@/pages/public/booking/PublicMyBookingsPage";
import PublicAuthPage from "@/pages/public/booking/PublicAuthPage";
import VendorPortalLayout from "@/pages/vendor/VendorPortalLayout";
import VendorDashboardPage from "@/pages/vendor/VendorDashboardPage";
import VendorServicesPage from "@/pages/vendor/VendorServicesPage";
import VendorQuotesPage from "@/pages/vendor/VendorQuotesPage";
import VendorCalendarPage from "@/pages/vendor/VendorCalendarPage";
import VendorChatPage from "@/pages/vendor/VendorChatPage";
import { Loader2 } from "lucide-react";

// V2 layouts
import PublicBookingLayoutV2 from "@/pages/public/booking/v2/PublicBookingLayoutV2";
import VendorPortalLayoutV2 from "@/pages/vendor/v2/VendorPortalLayoutV2";
import VendorProfilePage from "@/pages/vendor/v2/VendorProfilePage";
import VendorQuotesPageV2 from "@/pages/vendor/v2/VendorQuotesPageV2";
import PublicMyBookingsV2 from "@/pages/public/booking/v2/PublicMyBookingsV2";
import BookingAdminPage from "@/pages/admin/BookingAdminPage";
// V3 layout
import PublicBookingLayoutV3 from "@/pages/public/booking/v3/PublicBookingLayoutV3";

import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import PrivacySettingsPage from "@/pages/settings/PrivacySettingsPage";
import { toast as sonnerToast } from "sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
    mutations: {
      onError: (error: Error) => {
        sonnerToast.error(error.message || 'An error occurred');
      },
    },
  },
});

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
    <Route path="/bookivo" element={<BookivoPage />} />
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
      <Route path="/settings/privacy" element={<PrivacySettingsPage />} />
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
      <Route path="/apps/booking" element={<AppInstalledGate appId="booking"><BookingLayout /></AppInstalledGate>}>
        <Route index element={<BookingDashboard />} />
        <Route path="vendors" element={<BookingVendorsPage />} />
        <Route path="services" element={<BookingServicesPage />} />
        <Route path="calendar" element={<BookingCalendarPage />} />
        <Route path="quotes" element={<BookingQuotesPage />} />
        <Route path="bookings" element={<BookingBookingsPage />} />
        <Route path="settings" element={<BookingSettingsPage />} />
        <Route path="billing" element={<BillingPage />} />
      </Route>
      <Route path="/apps/leadership" element={<AppInstalledGate appId="leadership"><LeadershipPage /></AppInstalledGate>} />
      <Route path="/apps/leadership/settings" element={<AppInstalledGate appId="leadership"><LeadershipSettingsPage /></AppInstalledGate>} />
      <Route path="/enterprise/risk-dashboard" element={<RiskDashboardPage />} />
    </Route>
    {/* Public Booking Tenant App */}
    <Route path="/b/:tenantSlug" element={<PublicBookingLayout />}>
      <Route index element={<PublicBrowsePage />} />
      <Route path="v/:vendorId" element={<PublicVendorDetailPage />} />
      <Route path="request" element={<PublicRequestQuotePage />} />
      <Route path="my" element={<PublicMyBookingsPage />} />
      <Route path="auth" element={<PublicAuthPage />} />
    </Route>
    {/* Vendor Portal */}
    <Route path="/v/:tenantSlug" element={<VendorPortalLayout />}>
      <Route index element={<VendorDashboardPage />} />
      <Route path="services" element={<VendorServicesPage />} />
      <Route path="quotes" element={<VendorQuotesPage />} />
      <Route path="calendar" element={<VendorCalendarPage />} />
      <Route path="chat" element={<VendorChatPage />} />
    </Route>
    {/* V2 Public Booking (isolated) */}
    <Route path="/b2/:tenantSlug" element={<PublicBookingLayoutV2 />}>
      <Route index element={<PublicBrowsePage />} />
      <Route path="v/:vendorId" element={<PublicVendorDetailPage />} />
      <Route path="request" element={<PublicRequestQuotePage />} />
      <Route path="my" element={<PublicMyBookingsV2 />} />
      <Route path="auth" element={<PublicAuthPage />} />
    </Route>
    {/* V2 Vendor Portal (isolated) */}
    <Route path="/v2/:tenantSlug" element={<VendorPortalLayoutV2 />}>
      <Route index element={<VendorDashboardPage />} />
      <Route path="services" element={<VendorServicesPage />} />
      <Route path="quotes" element={<VendorQuotesPageV2 />} />
      <Route path="calendar" element={<VendorCalendarPage />} />
      <Route path="profile" element={<VendorProfilePage />} />
      <Route path="chat" element={<VendorChatPage />} />
    </Route>
    {/* V3 Public Booking (world-class storefront) */}
    <Route path="/b3/:tenantSlug" element={<PublicBookingLayoutV3 />}>
      <Route path="v/:vendorId" element={<PublicVendorDetailPage />} />
      <Route path="request" element={<PublicRequestQuotePage />} />
      <Route path="my" element={<PublicMyBookingsV2 />} />
      <Route path="auth" element={<PublicAuthPage />} />
    </Route>
    {/* Admin Backoffice (protected) */}
    <Route
      path="/admin/booking/:tenantSlug"
      element={
        <ProtectedRoute>
          <BookingAdminPage />
        </ProtectedRoute>
      }
    />
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
                      <OnboardingTour />
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
