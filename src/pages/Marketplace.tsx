import {
  FileText, Users, BarChart3, Package, ShoppingCart, Mail,
  Palette, Calendar, MessageSquare, Truck, CreditCard, Shield
} from "lucide-react";

interface MarketplaceApp {
  name: string;
  description: string;
  icon: React.ElementType;
  status: "active" | "available" | "coming_soon";
  category: string;
}

const marketplaceApps: MarketplaceApp[] = [
  { name: "Docs", description: "Invoices, quotations, and business documents", icon: FileText, status: "active", category: "Operations" },
  { name: "CRM", description: "Customer relationship management", icon: Users, status: "available", category: "Sales" },
  { name: "Accounting", description: "Financial management and reporting", icon: BarChart3, status: "available", category: "Finance" },
  { name: "Inventory", description: "Stock and warehouse management", icon: Package, status: "available", category: "Operations" },
  { name: "E-commerce", description: "Online store and order management", icon: ShoppingCart, status: "available", category: "Sales" },
  { name: "Marketing", description: "Campaigns, emails, and automation", icon: Mail, status: "available", category: "Marketing" },
  { name: "Design Studio", description: "Brand assets and templates", icon: Palette, status: "coming_soon", category: "Creative" },
  { name: "Scheduling", description: "Appointments and calendar management", icon: Calendar, status: "coming_soon", category: "Operations" },
  { name: "Support", description: "Help desk and ticketing system", icon: MessageSquare, status: "coming_soon", category: "Service" },
  { name: "Logistics", description: "Shipping and delivery tracking", icon: Truck, status: "coming_soon", category: "Operations" },
  { name: "Payments", description: "Payment processing and billing", icon: CreditCard, status: "coming_soon", category: "Finance" },
  { name: "Security", description: "Advanced security and compliance", icon: Shield, status: "coming_soon", category: "Admin" },
];

const statusStyles = {
  active: { label: "Active", bg: "bg-primary/10 text-primary" },
  available: { label: "Activate", bg: "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground cursor-pointer" },
  coming_soon: { label: "Coming Soon", bg: "bg-muted text-muted-foreground" },
};

export default function Marketplace() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">App Marketplace</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Extend your AI Brain's capabilities by activating business apps
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {marketplaceApps.map((app) => {
          const status = statusStyles[app.status];
          return (
            <div
              key={app.name}
              className={`rounded-xl border border-border bg-card p-5 space-y-4 transition-all hover:border-primary/20 ${
                app.status === "coming_soon" ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <app.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {app.category}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{app.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{app.description}</p>
              </div>
              <button className={`w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors ${status.bg}`}>
                {status.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
