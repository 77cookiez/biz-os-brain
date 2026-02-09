import { ArrowLeft, Moon, Palette, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Theme = 'dark' | 'light' | 'system';

export default function AppearanceSettingsPage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>('dark');

  const themes: { id: Theme; icon: React.ComponentType<{ className?: string }>; title: string }[] = [
    { id: 'dark', icon: Moon, title: 'Dark' },
    { id: 'light', icon: Sun, title: 'Light' },
    { id: 'system', icon: Palette, title: 'System' },
  ];

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    // TODO: Actually apply the theme
    toast.success(`Theme changed to ${newTheme}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/settings')}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appearance</h1>
          <p className="text-muted-foreground text-sm">Theme and display settings</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Theme
        </h3>
        
        <div className="grid grid-cols-3 gap-3">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => handleThemeChange(t.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                theme === t.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-secondary/50"
              )}
            >
              <div className={cn(
                "h-12 w-12 rounded-lg flex items-center justify-center",
                theme === t.id ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
              )}>
                <t.icon className="h-6 w-6" />
              </div>
              <span className={cn(
                "text-sm font-medium",
                theme === t.id ? "text-primary" : "text-muted-foreground"
              )}>
                {t.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
