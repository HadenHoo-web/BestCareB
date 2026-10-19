import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Activity, Overview, Theme } from '../types';
export const desktop = isTauri();
export async function getOverview(): Promise<Overview> { if (!desktop) throw new Error('Bản xem trước trình duyệt không kết nối SQLite. Mở ứng dụng desktop để sử dụng dữ liệu.'); return invoke('get_overview'); }
export const getActivities = (): Promise<Activity[]> => invoke('get_activities');
export const saveTheme = (theme: Theme): Promise<void> => invoke('save_theme', { theme });
