import { Search, Globe, ChevronDown, LogOut, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { user, profile, signOut } = useAuth();
  const { currentCompany, currentWorkspace, companies, workspaces, setCurrentCompany, setCurrentWorkspace } = useWorkspace();
  const { currentLanguage, enabledLanguages, cycleLanguage, setCurrentLanguage } = useLanguage();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/auth');
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header className="flex h-14 items-center border-b border-border bg-card px-4 gap-4">
      {/* AI Input */}
      <div className="flex-1 max-w-xl">
        <div 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground cursor-pointer hover:bg-secondary transition-colors"
        >
          <Search className="h-4 w-4 shrink-0 text-primary" />
          <span>Ask AI Brain anything...</span>
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Company & Workspace Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary transition-colors">
            <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
              {currentCompany?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="hidden md:flex flex-col items-start leading-none">
              <span className="text-xs font-medium text-foreground">{currentCompany?.name || 'Company'}</span>
              <span className="text-[10px] text-muted-foreground">{currentWorkspace?.name || 'Workspace'}</span>
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Companies</div>
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
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Workspaces</div>
          {workspaces.filter(w => w.company_id === currentCompany?.id).map(workspace => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => setCurrentWorkspace(workspace)}
              className={currentWorkspace?.id === workspace.id ? 'bg-secondary' : ''}
            >
              {workspace.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Language */}
      {enabledLanguages.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">{currentLanguage.code.toUpperCase()}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-popover border-border">
            {enabledLanguages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => setCurrentLanguage(lang)}
                className={cn(
                  "flex items-center justify-between",
                  currentLanguage.code === lang.code && "bg-secondary"
                )}
              >
                <span>{lang.nativeName}</span>
                <span className="text-xs text-muted-foreground">{lang.code.toUpperCase()}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button 
          onClick={() => navigate('/settings/language')}
          className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline text-xs font-medium">{currentLanguage.code.toUpperCase()}</span>
        </button>
      )}

      {/* User */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors text-xs font-medium text-primary">
            {initials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/brain/setup')}>
            Business Setup
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
