export type Theme = 'light' | 'dark';

export interface Overview {
  accounts: number; groups: number; campaigns: number; contents: number;
  confirmed: number; database_path: string; schema_version: number; theme: Theme;
  pendingJobs: number; completedJobs: number;
}

export interface Activity { id: number; action: string; created_at: string }
export interface Page<T> { items: T[]; total: number }

// ─── Account ─────────────────────────────────────────────────────────────────
export type ConnectionStatus = 'unconfirmed' | 'confirmed';
export type AccountCategory = 'personal' | 'business' | 'page' | 'other';
export interface Account {
  id: string; name: string; notes: string; avatarPath?: string | null;
  connectionStatus: ConnectionStatus; category: AccountCategory;
  groupCount: number; createdAt: string;
}
export interface AccountInput {
  name: string; notes: string; connectionStatus: ConnectionStatus; category: AccountCategory;
}

// ─── Group ────────────────────────────────────────────────────────────────────
export type AdvertisingStatus = 'unknown' | 'allowed' | 'prohibited';
export interface Group {
  id: string; url: string; facebookId?: string | null; name: string;
  description: string; topic: string; rules: string; advertising: AdvertisingStatus;
  favorite: boolean; blacklisted: boolean; lastUsedAt?: string | null; createdAt: string;
}
export interface GroupInput {
  url: string; name: string; description: string; topic: string;
  rules: string; advertising: AdvertisingStatus; favorite: boolean; blacklisted: boolean;
}
export interface GroupImportRow {
  url: string; name?: string; description?: string; topic?: string;
  rules?: string; advertising?: AdvertisingStatus; favorite?: boolean;
}
export interface BulkEditGroupInput {
  ids: string[];
  topic?: string;
  advertising?: AdvertisingStatus;
  blacklisted?: boolean;
}
export interface ImportResult { imported: number; skipped: number }

// ─── Account-Group Link ───────────────────────────────────────────────────────
export type MembershipStatus = 'unconfirmed' | 'joined' | 'not_joined';
export interface AccountGroupInput {
  accountId: string; groupId: string; membership: MembershipStatus;
}

// ─── Content ─────────────────────────────────────────────────────────────────
export interface ContentTemplate { id: string; title: string; body: string; hashtags: string; createdAt: string }
export interface ContentInput { title: string; body: string; hashtags: string }

// ─── AI ──────────────────────────────────────────────────────────────────────
export interface AiRequest {
  topic: string; product: string; audience: string;
  tone: 'professional' | 'friendly' | 'sales' | 'experience';
  length: 'short' | 'medium' | 'long';
  variants: number;
}
export interface AiDraft { title: string; body: string; hashtags: string; mode: string }
export interface AiConfig { configured: boolean; model: string }

// ─── Campaign ─────────────────────────────────────────────────────────────────
export interface Campaign {
  id: string; name: string; objective: string; audience: string;
  startsAt?: string | null; endsAt?: string | null; status: string; notes: string;
  groupCount: number; postCount: number; createdAt: string;
}
export interface CampaignInput {
  name: string; objective: string; audience: string;
  startsAt?: string; endsAt?: string; notes: string; groupIds: string[]; content: string;
}
export interface CampaignPost {
  id: string; campaignId: string; groupId: string; groupName: string; groupUrl: string;
  content: string; status: string; postUrl?: string | null; notes: string; createdAt: string;
}

// ─── Campaign Jobs V2 ─────────────────────────────────────────────────────────
export type JobStatus =
  | 'PENDING' | 'PREPARING' | 'READY'
  | 'AWAITING_USER' | 'COMPLETED' | 'FAILED'
  | 'CANCELLED' | 'SKIPPED';

export interface CampaignJob {
  id: string; campaignId: string; groupId: string;
  groupName: string; groupUrl: string; groupTopic: string;
  status: JobStatus; content: string; preparedContent?: string | null;
  errorMessage?: string | null; retryCount: number;
  scheduledAt?: string | null; startedAt?: string | null;
  completedAt?: string | null; createdAt: string;
}

export interface CampaignStats {
  total: number; pending: number; preparing: number; ready: number;
  awaitingUser: number; completed: number; failed: number;
  cancelled: number; skipped: number;
}

// ─── Publishing History ───────────────────────────────────────────────────────
export interface PublishingHistoryEntry {
  id: string; jobId: string; groupId: string; groupName: string;
  campaignId: string; campaignName: string; action: string;
  postUrl?: string | null; notes: string; createdAt: string;
}

// ─── Backup ──────────────────────────────────────────────────────────────────
export interface BackupFile { id: string; createdAt: string; bytes: number }
