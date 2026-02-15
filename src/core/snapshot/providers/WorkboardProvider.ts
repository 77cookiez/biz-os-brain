import type { SnapshotProvider } from '../types';

/**
 * WorkboardProvider — Metadata only (capture/restore is server-side).
 */
export const WorkboardProvider: SnapshotProvider = {
  id: 'workboard',
  version: 1,

  describe() {
    return {
      name: 'Workboard',
      description: 'Tasks, goals, plans, ideas',
      critical: true,
    };
  },
};
