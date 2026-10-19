import { LayoutDashboard, UsersRound, PanelsTopLeft, Sparkles, Megaphone, Library, History, Settings } from 'lucide-react';
export const navigation = [
  { path: '/', label: 'Tổng quan', icon: LayoutDashboard, description: 'Một góc nhìn rõ ràng cho công việc mỗi ngày.' },
  { path: '/accounts', label: 'Tài khoản Facebook', icon: UsersRound, description: 'Quản lý các tài khoản bạn sở hữu hoặc được phép sử dụng.', phase: 2 },
  { path: '/groups', label: 'Quản lý nhóm', icon: PanelsTopLeft, description: 'Tập hợp cộng đồng, lưu quy định và chuẩn bị nội dung phù hợp.', phase: 2 },
  { path: '/content', label: 'Sáng tạo với AI', icon: Sparkles, description: 'Từ ý tưởng đến nội dung mang dấu ấn của bạn.', phase: 3 },
  { path: '/campaigns', label: 'Chiến dịch', icon: Megaphone, description: 'Lên kế hoạch nội dung và theo dõi từng bước thực hiện.', phase: 3 },
  { path: '/library', label: 'Thư viện bài viết', icon: Library, description: 'Không gian dành cho những nội dung đã chuẩn bị.', phase: 3 },
  { path: '/history', label: 'Lịch sử hoạt động', icon: History, description: 'Theo dõi những thao tác thực tế trong không gian làm việc.' },
  { path: '/settings', label: 'Cài đặt', icon: Settings, description: 'Thiết lập không gian làm việc theo cách của bạn.' },
];
