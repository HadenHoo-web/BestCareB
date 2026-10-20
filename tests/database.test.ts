import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../src/services/database', () => ({ desktop: true, getOverview: vi.fn(), getActivities: vi.fn(), saveTheme: vi.fn() }));
import { getOverview, getActivities, saveTheme } from '../src/services/database';
import { useApp } from '../src/stores/app';
const overview = { accounts: 0, groups: 0, campaigns: 0, contents: 0, confirmed: 0, database_path: '/test.sqlite', schema_version: 2, theme: 'dark' as const, pendingJobs: 0, completedJobs: 0 };
describe('desktop state and failure handling', () => {
  beforeEach(() => { vi.resetAllMocks(); useApp.setState({ theme: 'light', status: 'loading', overview: null, activities: [], error: null }); });
  it('loads actual overview and persisted theme from the native service', async () => { vi.mocked(getOverview).mockResolvedValue(overview); vi.mocked(getActivities).mockResolvedValue([]); await useApp.getState().refresh(); expect(useApp.getState()).toMatchObject({ status: 'ready', theme: 'dark', overview }); });
  it('reports database errors without pretending data loaded', async () => { vi.mocked(getOverview).mockRejectedValue(new Error('internal detail')); vi.mocked(getActivities).mockResolvedValue([]); await useApp.getState().refresh(); expect(useApp.getState().status).toBe('error'); expect(useApp.getState().overview).toBeNull(); expect(useApp.getState().error).not.toContain('internal detail'); });
  it('does not change theme if persistence fails', async () => { vi.mocked(saveTheme).mockRejectedValue(new Error('write failed')); await expect(useApp.getState().setTheme('dark')).rejects.toThrow(); expect(useApp.getState().theme).toBe('light'); });
});
