import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Factory, ShoppingCart, Briefcase, Globe, HelpCircle, ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

type BusinessType = 'trade' | 'services' | 'factory' | 'online' | 'retail' | 'consulting' | 'other';

const businessTypes: { value: BusinessType; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'trade', label: 'Trade', icon: Briefcase, description: 'Buy and sell goods' },
  { value: 'services', label: 'Services', icon: Users, description: 'Provide professional services' },
  { value: 'factory', label: 'Manufacturing', icon: Factory, description: 'Produce goods' },
  { value: 'online', label: 'Online Business', icon: Globe, description: 'Digital products or services' },
  { value: 'retail', label: 'Retail', icon: ShoppingCart, description: 'Sell to consumers' },
  { value: 'consulting', label: 'Consulting', icon: Building2, description: 'Advisory services' },
  { value: 'other', label: 'Other', icon: HelpCircle, description: 'Something else' },
];

const teamSizes = [
  { value: 'solo', label: 'Just me' },
  { value: '2-5', label: '2-5 people' },
  { value: '6-20', label: '6-20 people' },
  { value: '21-50', label: '21-50 people' },
  { value: '50+', label: '50+ people' },
];

export default function BusinessSetupPage() {
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [businessDescription, setBusinessDescription] = useState('');
  const [primaryPain, setPrimaryPain] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [goals, setGoals] = useState<string[]>(['', '', '']);
  const [loading, setLoading] = useState(false);
  const { businessContext, updateBusinessContext, currentWorkspace } = useWorkspace();
  const navigate = useNavigate();

  // Load existing context
  useEffect(() => {
    if (businessContext) {
      if (businessContext.business_type) setBusinessType(businessContext.business_type as BusinessType);
      if (businessContext.business_description) setBusinessDescription(businessContext.business_description);
      if (businessContext.primary_pain) setPrimaryPain(businessContext.primary_pain);
      if (businessContext.team_size) setTeamSize(businessContext.team_size);
      if (businessContext.ninety_day_focus) setGoals([...businessContext.ninety_day_focus, '', '', ''].slice(0, 3));
    }
  }, [businessContext]);

  const handleComplete = async () => {
    setLoading(true);
    try {
      await updateBusinessContext({
        business_type: businessType,
        business_description: businessDescription,
        primary_pain: primaryPain,
        team_size: teamSize,
        has_team: teamSize !== 'solo',
        ninety_day_focus: goals.filter(g => g.trim()),
        setup_completed: true,
      });
      toast.success('Business setup complete!');
      navigate('/');
    } catch (error) {
      toast.error('Failed to save setup');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return businessType !== null;
      case 2: return businessDescription.trim().length > 10;
      case 3: return primaryPain.trim().length > 5;
      case 4: return teamSize !== '';
      case 5: return goals.filter(g => g.trim()).length >= 1;
      default: return false;
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-8 px-4">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Step {step} of 5</span>
          <span className="text-sm text-muted-foreground">{Math.round((step / 5) * 100)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1: Business Type */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">What type of business do you run?</h1>
            <p className="text-muted-foreground">This helps AI Brain understand your context</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {businessTypes.map(type => (
              <button
                key={type.value}
                onClick={() => setBusinessType(type.value)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  businessType === type.value 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                <type.icon className={`h-6 w-6 mb-2 ${businessType === type.value ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="font-medium text-foreground text-sm">{type.label}</p>
                <p className="text-xs text-muted-foreground">{type.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Business Description */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Tell me about your business</h1>
            <p className="text-muted-foreground">A brief description helps AI Brain give better advice</p>
          </div>
          <Textarea
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            placeholder="We are a small retail shop selling organic products in downtown..."
            className="min-h-[120px] bg-input border-border text-foreground"
          />
          <p className="text-xs text-muted-foreground text-center">
            {businessDescription.length} characters (minimum 10)
          </p>
        </div>
      )}

      {/* Step 3: Primary Pain */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">What's your biggest challenge?</h1>
            <p className="text-muted-foreground">We'll focus on solving this first</p>
          </div>
          <Textarea
            value={primaryPain}
            onChange={(e) => setPrimaryPain(e.target.value)}
            placeholder="We struggle with managing inventory and often run out of popular items..."
            className="min-h-[120px] bg-input border-border text-foreground"
          />
        </div>
      )}

      {/* Step 4: Team Size */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">How big is your team?</h1>
            <p className="text-muted-foreground">This helps us tailor recommendations</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {teamSizes.map(size => (
              <button
                key={size.value}
                onClick={() => setTeamSize(size.value)}
                className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                  teamSize === size.value 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                <span className="font-medium text-foreground">{size.label}</span>
                {teamSize === size.value && <Check className="h-5 w-5 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 5: 90-Day Goals */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Your 90-day focus</h1>
            <p className="text-muted-foreground">What do you want to achieve in the next 90 days? (1-3 goals)</p>
          </div>
          <div className="space-y-3">
            {goals.map((goal, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-lg font-bold text-primary">{i + 1}</span>
                <Input
                  value={goal}
                  onChange={(e) => {
                    const newGoals = [...goals];
                    newGoals[i] = e.target.value;
                    setGoals(newGoals);
                  }}
                  placeholder={i === 0 ? "Increase monthly revenue by 20%" : "Optional goal..."}
                  className="bg-input border-border text-foreground"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <Button
          variant="ghost"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        {step < 5 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleComplete} disabled={!canProceed() || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Complete Setup
            <Check className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
