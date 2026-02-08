import { Settings as SettingsIcon, Building, Globe, Users, Bell, Palette } from "lucide-react";

const settingSections = [
  { icon: Building, title: "Company", description: "Manage company details and branding" },
  { icon: Users, title: "Team & Roles", description: "Invite members and assign permissions" },
  { icon: Globe, title: "Language & Region", description: "Set language, timezone, and direction" },
  { icon: Bell, title: "Notifications", description: "Configure alert preferences" },
  { icon: Palette, title: "Appearance", description: "Theme and display settings" },
];

export default function SettingsPage() {
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
            className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:bg-secondary hover:border-primary/20"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <s.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
