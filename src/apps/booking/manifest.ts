export const BOOKING_APP_ID = 'booking';

export const bookingManifest = {
  id: BOOKING_APP_ID,
  name: 'Bookivo',
  description: 'AI-powered booking infrastructure for modern service businesses worldwide. Manage vendors, services, quotes, bookings, payments, and chat in one unified system.',
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
