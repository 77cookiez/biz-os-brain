import { Globe, ChevronDown, LogOut, Building2, Plus, Users, Sun, Moon, Monitor } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "react-i18next";
import { BrainCommandBar } from "@/components/brain/BrainCommandBar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

export function TopBar() {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const { currentCompany, currentWorkspace, companies, workspaces, setCurrentCompany, setCurrentWorkspace } = useWorkspace();
  const { currentLanguage, setCurrentLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isBrainPage = location.pathname === '/brain';

  const handleSignOut = async () => {
    await signOut();
    toast.success(t('toast.signedOut'));
    navigate('/auth');
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header className="flex h-14 items-center border-b border-border bg-card px-4 gap-4">
      {/* Global Brain Command Bar — hidden on /brain to avoid duplication */}
      {!isBrainPage && <BrainCommandBar />}

      {/* Company & Workspace Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary transition-colors">
            {currentCompany?.logo_url ? (
              <img 
                src={currentCompany.logo_url} 
                alt={currentCompany.name} 
                className="h-6 w-6 rounded-md object-cover"
              />
            ) : (
              <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {currentCompany?.name?.[0]?.toUpperCase() || 'A'}
              </div>
            )}
            <div className="hidden md:flex flex-col items-start leading-none">
              <span className="text-xs font-medium text-foreground">{currentCompany?.name || 'Company'}</span>
              <span className="text-[10px] text-muted-foreground">{currentWorkspace?.name || 'Workspace'}</span>
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{t('topbar.companies')}</div>
          {companies.map(company => (
            <DropdownMenuItem
              key={company.id}
              onClick={() => setCurrentCompany(company)}
              className={currentCompany?.id === company.id ? 'bg-secondary' : ''}
            >
              <Building2 className="h-4 w-4 mr-2" />
              {company.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{t('topbar.workspaces')}</div>
          {workspaces.filter(w => w.company_id === currentCompany?.id).map(workspace => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => setCurrentWorkspace(workspace)}
              className={currentWorkspace?.id === workspace.id ? 'bg-secondary' : ''}
            >
              {workspace.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/settings/workspaces')}>
            <Plus className="h-4 w-4 mr-2" />
            {t('topbar.newWorkspace')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/settings/team')}>
            <Users className="h-4 w-4 mr-2" />
            {t('topbar.teamRoles')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notifications */}
      <NotificationBell />

      {/* Language */}
      <button 
        onClick={() => navigate('/settings/language')}
        className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline text-xs font-medium">{currentLanguage.code.toUpperCase()}</span>
      </button>

      {/* User */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="focus:outline-none">
            <Avatar className="h-8 w-8 hover:ring-2 hover:ring-primary/50 transition-all">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={displayName} />
              ) : null}
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            {t('common.settings')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/brain/setup')}>
            {t('topbar.businessSetup')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{t('settings.appearance.title')}</div>
          <div className="flex items-center gap-1 px-2 pb-2">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                theme === 'light' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              )}
            >
              <Sun className="h-3.5 w-3.5" />
              {t('settings.appearance.light')}
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                theme === 'dark' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              )}
            >
              <Moon className="h-3.5 w-3.5" />
              {t('settings.appearance.dark')}
            </button>
            <button
              onClick={() => setTheme('system')}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                theme === 'system' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              )}
            >
              <Monitor className="h-3.5 w-3.5" />
              {t('settings.appearance.system')}
            </button>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
            <LogOut className="h-4 w-4 mr-2" />
            {t('topbar.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
