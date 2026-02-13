export const BOOKING_APP_ID = 'booking';

export const bookingManifest = {
  id: BOOKING_APP_ID,
  name: 'Booking OS',
  description: 'AI-powered booking marketplace engine. Manage vendors, services, quotes, and bookings with built-in contextual chat and GCC-first payments.',
  icon: 'calendar-check',
  pricing: 'subscription' as const,
  capabilities: [
    'booking_marketplace',
    'vendor_management',
    'quote_system',
    'booking_calendar',
    'contextual_chat',
  ],
  routes: {
    index: `/apps/${BOOKING_APP_ID}`,
    vendors: `/apps/${BOOKING_APP_ID}/vendors`,
    services: `/apps/${BOOKING_APP_ID}/services`,
    calendar: `/apps/${BOOKING_APP_ID}/calendar`,
    quotes: `/apps/${BOOKING_APP_ID}/quotes`,
    bookings: `/apps/${BOOKING_APP_ID}/bookings`,
    settings: `/apps/${BOOKING_APP_ID}/settings`,
  },
};
