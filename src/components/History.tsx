import { Download, History as HistoryIcon } from 'lucide-react';
import { toast } from 'sonner';
import { exportReportCsv } from '../services/database';
import { useApp } from '../stores/app';
import { Button } from './ui/button';

export function History(){
  const{activities,overview}=useApp();
  const download=async()=>{try{const content=await exportReportCsv();const blob=new Blob([content],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='fb-manager-campaign-report.csv';link.click();URL.revokeObjectURL(url);toast.success('Đã xuất báo cáo CSV.')}catch{toast.error('Không thể xuất báo cáo.')}};
  return <section className="card">{activities.length?<><div className="list-toolbar"><h2>Lịch sử hoạt động</h2><Button variant="outline" onClick={()=>void download()}><Download size={16}/>Xuất báo cáo CSV</Button></div><table><thead><tr><th>Hoạt động</th><th>Thời gian (UTC)</th></tr></thead><tbody>{activities.map(item=><tr key={item.id}><td>{item.action}</td><td>{item.created_at}</td></tr>)}</tbody></table></>:<div className="empty-state"><span className="empty-icon"><HistoryIcon size={30}/></span><h2>{overview?'Chưa có hoạt động được ghi nhận':'Chưa kết nối lịch sử'}</h2><p>{overview?'Nhật ký sẽ hiển thị các thao tác có dữ liệu thực.':'Mở ứng dụng desktop để đọc nhật ký SQLite.'}</p></div>}</section>;
}
