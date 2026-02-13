export const LEADERSHIP_APP_ID = 'leadership';

export const leadershipManifest = {
  id: LEADERSHIP_APP_ID,
  name: 'Leadership Augmentation',
  description: 'AI-powered leadership coaching, team dynamics analysis, and strategic decision support.',
  icon: 'crown',
  pricing: 'paid' as const,
  capabilities: ['leadership_coaching', 'team_dynamics', 'decision_support', 'meeting_prep'],
  routes: {
    index: `/apps/${LEADERSHIP_APP_ID}`,
    settings: `/apps/${LEADERSHIP_APP_ID}/settings`,
  },
};
