/**
 * TeamChatProvider — Descriptor only (v2).
 * Capture/restore logic is entirely server-side.
 * Caps: MAX_MESSAGES=2000, attachments metadata only.
 */
import type { ProviderDescriptor } from '../types';

export const TeamChatDescriptor: ProviderDescriptor = {
  provider_id: 'team_chat',
  name: 'Team Chat',
  description: 'Channels, messages, threads, attachment references (no file blobs)',
  critical: false,
  default_policy: 'metadata_only',
  is_enabled: true,
};

// Legacy export for backward compat with tests
export const TeamChatProvider = {
  id: 'team_chat',
  version: 1,
  describe: () => ({
    name: TeamChatDescriptor.name,
    description: TeamChatDescriptor.description,
    critical: TeamChatDescriptor.critical,
  }),
};
