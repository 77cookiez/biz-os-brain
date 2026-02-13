import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Users, Brain, Calendar, Settings, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const capabilities = [
  {
    icon: Brain,
    title: 'AI Coaching Sessions',
    description: 'Get personalized leadership coaching based on your team dynamics and business context.',
  },
  {
    icon: Users,
    title: 'Team Dynamics Analysis',
    description: 'Understand team engagement patterns, communication gaps, and collaboration health.',
  },
  {
    icon: Calendar,
    title: 'Meeting Prep Briefs',
    description: 'AI-generated briefs with key talking points, risks, and decisions for upcoming meetings.',
  },
  {
    icon: Sparkles,
    title: 'Decision Support',
    description: 'Strategic recommendations powered by your organization\'s data and industry patterns.',
  },
];

export default function LeadershipPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <div className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            {t('leadership.title', 'Leadership Augmentation')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('leadership.subtitle', 'AI-powered coaching and strategic decision support')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => navigate('/apps/leadership/settings')}
        >
          <Settings className="h-3.5 w-3.5" />
          {t('common.settings', 'Settings')}
        </Button>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {t('leadership.welcome', 'Welcome to Leadership Augmentation')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('leadership.welcomeDesc', 'Start a coaching session with your AI Business Brain to get personalized leadership insights.')}
            </p>
          </div>
          <Badge variant="outline" className="ml-auto shrink-0 border-primary/30 text-primary">
            {t('common.paid', 'Paid')}
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {capabilities.map((cap) => (
          <Card key={cap.title} className="border-border bg-card hover:border-primary/30 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                <cap.icon className="h-4 w-4 text-primary" />
                {cap.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{cap.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-card">
        <CardContent className="py-8 text-center">
          <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {t('leadership.comingSoon', 'Full coaching sessions and team analytics coming soon. Use the Brain to ask leadership questions now.')}
          </p>
          <Button className="mt-4" size="sm" onClick={() => navigate('/brain')}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {t('leadership.openBrain', 'Open Brain')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
