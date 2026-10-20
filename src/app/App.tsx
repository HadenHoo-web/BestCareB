import { HashRouter, Route, Routes } from 'react-router-dom';
import { DesktopLayout } from '../layouts/DesktopLayout';
import { Dashboard } from '../modules/dashboard/Dashboard';
import { Settings } from '../modules/settings/Settings';
import { ModulePlaceholder } from '../components/ModulePlaceholder';
import { History } from '../components/History';
import { Accounts } from '../modules/accounts/Accounts';
import { Groups } from '../modules/groups/Groups';
import { Content } from '../modules/content/Content';
import { Campaigns } from '../modules/campaigns/Campaigns';
export function App() { return <HashRouter><Routes><Route element={<DesktopLayout/>}><Route index element={<Dashboard/>}/><Route path="accounts" element={<Accounts/>}/><Route path="groups" element={<Groups/>}/><Route path="content" element={<Content/>}/><Route path="library" element={<Content/>}/><Route path="campaigns" element={<Campaigns/>}/><Route path="settings" element={<Settings/>}/><Route path="history" element={<History/>}/><Route path="*" element={<ModulePlaceholder/>}/></Route></Routes></HashRouter>; }
