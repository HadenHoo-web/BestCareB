export type Theme = 'light' | 'dark';
export interface Overview { accounts: number; groups: number; campaigns: number; contents: number; confirmed: number; database_path: string; schema_version: number; theme: Theme }
export interface Activity { id: number; action: string; created_at: string }
