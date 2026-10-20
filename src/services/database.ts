import { invoke, isTauri } from '@tauri-apps/api/core';
import type {
  Account, AccountInput, AccountGroupInput,
  Activity, AiConfig, AiDraft, AiRequest,
  BackupFile, BulkEditGroupInput,
  Campaign, CampaignInput, CampaignJob, CampaignPost, CampaignStats,
  ContentInput, ContentTemplate,
  Group, GroupImportRow, GroupInput,
  ImportResult, Overview, Page, PublishingHistoryEntry, Theme,
} from '../types';

export const desktop = isTauri();

// ─── Overview ────────────────────────────────────────────────────────────────
export async function getOverview(): Promise<Overview> {
  if (!desktop) throw new Error('Bản xem trước trình duyệt không kết nối SQLite. Mở ứng dụng desktop để sử dụng dữ liệu.');
  return invoke('get_overview');
}
export const getActivities = (): Promise<Activity[]> => invoke('get_activities');
export const saveTheme = (theme: Theme): Promise<void> => invoke('save_theme', { theme });

// ─── Backup ──────────────────────────────────────────────────────────────────
export const listBackups = (): Promise<BackupFile[]> => invoke('list_backups');
export const createBackup = (): Promise<BackupFile> => invoke('create_backup');
export const restoreBackup = (id: string): Promise<void> => invoke('restore_backup', { id });
export const exportReportCsv = (): Promise<string> => invoke('export_report_csv');

// ─── Accounts ────────────────────────────────────────────────────────────────
export const listAccounts = (query: string, page = 1, pageSize = 20): Promise<Page<Account>> =>
  invoke('list_accounts', { query, page, pageSize });
export const createAccount = (input: AccountInput): Promise<Account> =>
  invoke('create_account', { input });
export const updateAccount = (id: string, input: AccountInput): Promise<Account> =>
  invoke('update_account', { id, input });
export const deleteAccounts = (ids: string[]): Promise<void> =>
  invoke('delete_accounts', { ids });

// ─── Account ↔ Group Links ────────────────────────────────────────────────────
export const linkAccountGroup = (input: AccountGroupInput): Promise<void> =>
  invoke('link_account_group', { input });
export const unlinkAccountGroup = (accountId: string, groupId: string): Promise<void> =>
  invoke('unlink_account_group', { accountId, groupId });
export const listAccountGroups = (accountId: string): Promise<Group[]> =>
  invoke('list_account_groups', { accountId });

// ─── Groups ──────────────────────────────────────────────────────────────────
export const listGroups = (
  query: string, topic: string, favoriteOnly: boolean,
  blacklistedOnly = false, page = 1, pageSize = 20,
): Promise<Page<Group>> =>
  invoke('list_groups', { query, topic, favoriteOnly, blacklistedOnly, page, pageSize });
export const createGroup = (input: GroupInput): Promise<Group> =>
  invoke('create_group', { input });
export const updateGroup = (id: string, input: GroupInput): Promise<Group> =>
  invoke('update_group', { id, input });
export const deleteGroups = (ids: string[]): Promise<void> =>
  invoke('delete_groups', { ids });
export const importGroups = (rows: GroupImportRow[]): Promise<ImportResult> =>
  invoke('import_groups', { rows });
export const openFacebookGroup = (url: string): Promise<void> =>
  invoke('open_facebook_group', { url });
export const openUrlInBrowser = (url: string): Promise<void> =>
  invoke('open_url_in_browser', { url });
export const bulkEditGroups = (input: BulkEditGroupInput): Promise<number> =>
  invoke('bulk_edit_groups', { input });

// ─── Content ─────────────────────────────────────────────────────────────────
export const listContent = (query: string, page = 1, pageSize = 50): Promise<Page<ContentTemplate>> =>
  invoke('list_content', { query, page, pageSize });
export const createContent = (input: ContentInput): Promise<ContentTemplate> =>
  invoke('create_content', { input });
export const updateContent = (id: string, input: ContentInput): Promise<ContentTemplate> =>
  invoke('update_content', { id, input });
export const deleteContent = (ids: string[]): Promise<void> =>
  invoke('delete_content', { ids });

// ─── AI ──────────────────────────────────────────────────────────────────────
export const getAiConfig = (): Promise<AiConfig> => invoke('get_ai_config');
export const saveAiConfig = (apiKey: string, model: string): Promise<void> =>
  invoke('save_ai_config', { input: { apiKey, model } });
export const clearAiConfig = (): Promise<void> => invoke('clear_ai_config');
export const generateContent = (input: AiRequest): Promise<AiDraft[]> =>
  invoke('generate_content', { input });

// ─── Campaigns ───────────────────────────────────────────────────────────────
export const listCampaigns = (query: string, page = 1, pageSize = 50): Promise<Page<Campaign>> =>
  invoke('list_campaigns', { query, page, pageSize });
export const createCampaign = (input: CampaignInput): Promise<Campaign> =>
  invoke('create_campaign', { input });
export const updateCampaign = (id: string, input: CampaignInput): Promise<Campaign> =>
  invoke('update_campaign', { id, input });
export const deleteCampaign = (id: string): Promise<void> =>
  invoke('delete_campaign', { id });
export const listCampaignPosts = (campaignId: string): Promise<CampaignPost[]> =>
  invoke('list_campaign_posts', { campaignId });
export const setCampaignPostStatus = (id: string, status: string, postUrl?: string): Promise<void> =>
  invoke('set_campaign_post_status', { id, status, postUrl: postUrl ?? null });

// ─── Campaign Jobs V2 ─────────────────────────────────────────────────────────
export const listCampaignJobs = (campaignId: string): Promise<CampaignJob[]> =>
  invoke('list_campaign_jobs', { campaignId });
export const getCampaignStats = (campaignId: string): Promise<CampaignStats> =>
  invoke('get_campaign_stats', { campaignId });
export const advanceJobStatus = (id: string, status: string, notes?: string): Promise<CampaignJob> =>
  invoke('advance_job_status', { id, status, notes: notes ?? null });
export const updateCampaignJobContent = (id: string, content: string): Promise<CampaignJob> =>
  invoke('update_campaign_job_content', { id, content });
export const cancelCampaignJobs = (campaignId: string): Promise<number> =>
  invoke('cancel_campaign_jobs', { campaignId });
export const getPublishingHistory = (groupId?: string, page = 1, pageSize = 50): Promise<Page<PublishingHistoryEntry>> =>
  invoke('get_publishing_history', { groupId: groupId ?? null, page, pageSize });
