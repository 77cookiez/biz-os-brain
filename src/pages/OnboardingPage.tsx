import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Building2, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import logoIcon from '@/assets/logo-icon.png';

export default function OnboardingPage() {
  const [companyName, setCompanyName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('Main Office');
  const [loading, setLoading] = useState(false);
  const { createCompanyAndWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await createCompanyAndWorkspace(companyName, workspaceName);
      if (result) {
        toast.success('Your workspace is ready!');
        navigate('/brain/setup');
      } else {
        toast.error('Failed to create workspace');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <img src={logoIcon} alt="AiBizos" className="h-10 w-10 rounded-lg" />
            <span className="text-xl font-bold text-foreground">
              Ai<span className="text-primary">Bizos</span>
            </span>
          </div>
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl text-foreground">
            Set up your business
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Create your company and first workspace to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName" className="text-foreground">Company Name</Label>
              <Input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corp"
                required
                className="bg-input border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspaceName" className="text-foreground">First Workspace</Label>
              <Input
                id="workspaceName"
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Main Office, HQ, etc."
                required
                className="bg-input border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Workspaces help you organize by branch, department, or project
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Continue to Business Setup
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
