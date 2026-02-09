import { ArrowLeft, Building, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useState } from "react";
import { toast } from "sonner";

export default function CompanySettingsPage() {
  const navigate = useNavigate();
  const { currentCompany } = useWorkspace();
  const [companyName, setCompanyName] = useState(currentCompany?.name || '');

  const handleSave = () => {
    // TODO: Implement company update
    toast.success('Company settings saved');
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
          <h1 className="text-2xl font-bold text-foreground">Company</h1>
          <p className="text-muted-foreground text-sm">Manage company details and branding</p>
        </div>
      </div>

      <div className="space-y-6 rounded-xl border border-border bg-card p-6">
        {/* Company Logo */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
            {currentCompany?.name?.[0]?.toUpperCase() || 'C'}
          </div>
          <Button variant="outline" size="sm">
            <Camera className="h-4 w-4 mr-2" />
            Change Logo
          </Button>
        </div>

        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="company-name">Company Name</Label>
          <Input
            id="company-name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Enter company name"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}
