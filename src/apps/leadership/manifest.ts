export const LEADERSHIP_APP_ID = 'leadership';

export const leadershipManifest = {
  id: LEADERSHIP_APP_ID,
  name: 'Aurelius — Executive Intelligence',
  description: 'AI-powered executive intelligence: leadership coaching, team dynamics analysis, and strategic decision support.',
  icon: 'crown',
  pricing: 'paid' as const,
  capabilities: ['leadership_coaching', 'team_dynamics', 'decision_support', 'meeting_prep'],
  routes: {
    index: `/apps/${LEADERSHIP_APP_ID}`,
    settings: `/apps/${LEADERSHIP_APP_ID}/settings`,
  },
};
