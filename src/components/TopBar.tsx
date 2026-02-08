import { Search, Globe, ChevronDown, User } from "lucide-react";
import { useState } from "react";

export function TopBar() {
  const [company] = useState("Acme Corp");
  const [workspace] = useState("Main Office");

  return (
    <header className="flex h-14 items-center border-b border-border bg-card px-4 gap-4">
      {/* AI Input */}
      <div className="flex-1 max-w-xl">
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground cursor-text hover:bg-secondary transition-colors">
          <Search className="h-4 w-4 shrink-0 text-primary" />
          <span>Ask AI Brain anything...</span>
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Company & Workspace Switcher */}
      <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary transition-colors">
        <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
          A
        </div>
        <div className="hidden md:flex flex-col items-start leading-none">
          <span className="text-xs font-medium text-foreground">{company}</span>
          <span className="text-[10px] text-muted-foreground">{workspace}</span>
        </div>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {/* Language */}
      <button className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors">
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline text-xs">EN</span>
      </button>

      {/* User */}
      <button className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors">
        <User className="h-4 w-4 text-primary" />
      </button>
    </header>
  );
}
