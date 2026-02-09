import { Building, Globe, Users, Bell, Palette, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const settingSections = [
  { icon: Building, title: "Company", description: "Manage company details and branding", path: "/settings/company" },
  { icon: Users, title: "Team & Roles", description: "Invite members and assign permissions", path: "/settings/team" },
  { icon: Globe, title: "Language & Region", description: "Set language, timezone, and direction", path: "/settings/language" },
  { icon: Bell, title: "Notifications", description: "Configure alert preferences", path: "/settings/notifications" },
  { icon: Palette, title: "Appearance", description: "Theme and display settings", path: "/settings/appearance" },
];

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your workspace and preferences</p>
      </div>

      <div className="space-y-2">
        {settingSections.map((s) => (
          <button
            key={s.title}
            onClick={() => navigate(s.path)}
            className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:bg-secondary hover:border-primary/20"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <s.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
