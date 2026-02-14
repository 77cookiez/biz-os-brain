
-- Phase A: Update canonical plans to match spec
UPDATE billing_plans SET
  vendors_limit = 3,
  services_limit = 5,
  bookings_limit = 20,
  quotes_limit = 30,
  seats_limit = 2,
  features = '{"growth_insights":false,"priority_support":false,"advanced_insights":false,"white_label":false}'::jsonb
WHERE id = 'free';

UPDATE billing_plans SET
  name = 'Pro',
  vendors_limit = 15,
  services_limit = 25,
  bookings_limit = 150,
  quotes_limit = 200,
  seats_limit = 5,
  features = '{"growth_insights":true,"priority_support":true,"advanced_insights":false,"white_label":false}'::jsonb
WHERE id = 'professional';

UPDATE billing_plans SET
  name = 'Business',
  vendors_limit = NULL,
  services_limit = NULL,
  bookings_limit = 1000,
  quotes_limit = 1500,
  seats_limit = 15,
  features = '{"growth_insights":true,"priority_support":true,"advanced_insights":true,"white_label":true}'::jsonb
WHERE id = 'enterprise';
