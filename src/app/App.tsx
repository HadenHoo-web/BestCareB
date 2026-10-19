import { HashRouter, Route, Routes } from 'react-router-dom';
import { DesktopLayout } from '../layouts/DesktopLayout';
import { Dashboard } from '../modules/dashboard/Dashboard';
import { Settings } from '../modules/settings/Settings';
import { ModulePlaceholder } from '../components/ModulePlaceholder';
import { History } from '../components/History';
export function App() { return <HashRouter><Routes><Route element={<DesktopLayout/>}><Route index element={<Dashboard/>}/><Route path="settings" element={<Settings/>}/><Route path="history" element={<History/>}/><Route path="*" element={<ModulePlaceholder/>}/></Route></Routes></HashRouter>; }
