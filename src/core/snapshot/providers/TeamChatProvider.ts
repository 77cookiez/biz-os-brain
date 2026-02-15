import type { SnapshotProvider } from '../types';

/**
 * TeamChatProvider — Metadata only (capture/restore is server-side).
 * Capture caps: MAX_MESSAGES=2000, body truncated to 2k chars (enforced server-side).
 */
export const TeamChatProvider: SnapshotProvider = {
  id: 'team_chat',
  version: 1,

  describe() {
    return {
      name: 'Team Chat',
      description: 'Channels, messages, threads, attachment references (no file blobs)',
      critical: false,
    };
  },
};
