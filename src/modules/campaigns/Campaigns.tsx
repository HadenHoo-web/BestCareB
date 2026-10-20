import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Ban, Bot, CheckCheck, ChevronDown, ChevronRight, Clock, Copy,
  ExternalLink, Image as ImageIcon, Loader2, Megaphone, Pencil, Plus, RefreshCw, Rocket, SkipForward, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Campaign, CampaignInput, CampaignJob, CampaignStats, Group, JobStatus } from '../../types';
import {
  advanceJobStatus, cancelCampaignJobs, createCampaign, deleteCampaign, getCampaignStats,
  listCampaignJobs, listCampaigns, listGroups, openFacebookGroup, openUrlInBrowser,
  updateCampaign, updateCampaignJobContent,
} from '../../services/database';
import { getCampaignImages, saveCampaignImages, compressImageToDataUrl, isImageFile } from '../../services/media';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/Modal';

const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  PENDING: 'Chờ xử lý', PREPARING: 'Đang chuẩn bị', READY: 'Sẵn sàng',
  AWAITING_USER: 'Chờ bạn đăng', COMPLETED: 'Đã hoàn tất',
  FAILED: 'Thất bại', CANCELLED: 'Đã hủy', SKIPPED: 'Bỏ qua',
};

const JOB_STATUS_COLOR: Record<JobStatus, string> = {
  PENDING: '', PREPARING: 'blue', READY: 'teal', AWAITING_USER: 'amber',
  COMPLETED: 'allowed', FAILED: 'prohibited', CANCELLED: '', SKIPPED: '',
};

const NEXT_ACTION: Partial<Record<JobStatus, { label: string; next: JobStatus; icon?: React.ReactNode }>> = {
  PENDING:       { label: 'Bắt đầu chuẩn bị', next: 'PREPARING' },
  PREPARING:     { label: 'Đánh dấu Sẵn sàng',  next: 'READY' },
  READY:         { label: 'Giao cho bạn đăng',   next: 'AWAITING_USER' },
  AWAITING_USER: { label: 'Tôi đã đăng xong',    next: 'COMPLETED' },
  FAILED:        { label: 'Thử lại',              next: 'PENDING' },
};

const empty: CampaignInput = { name: '', objective: '', audience: '', notes: '', groupIds: [], content: '' };

export function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [jobs, setJobs] = useState<CampaignJob[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('');

  const [selectedCampaignImages, setSelectedCampaignImages] = useState<string[]>([]);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingJobText, setEditingJobText] = useState('');
  const [savingJob, setSavingJob] = useState(false);

  const loadCampaigns = async () => {
    try { setCampaigns((await listCampaigns('')).items); }
    catch { toast.error('Không thể tải chiến dịch.'); }
  };

  const openCampaign = async (campaign: Campaign) => {
    setSelected(campaign); setLoadingJobs(true); setJobs([]); setStats(null); setSelectedCampaignImages([]);
    try {
      const [j, s, imgs] = await Promise.all([
        listCampaignJobs(campaign.id),
        getCampaignStats(campaign.id),
        getCampaignImages(campaign.id).catch(() => []),
      ]);
      setJobs(j); setStats(s); setSelectedCampaignImages(imgs);
    } catch { toast.error('Không thể tải jobs chiến dịch.'); }
    finally { setLoadingJobs(false); }
  };

  useEffect(() => { void loadCampaigns(); }, []);

  const refreshJobs = () => { if (selected) void openCampaign(selected); };

  const startEditJobContent = (job: CampaignJob) => {
    setEditingJobId(job.id);
    setEditingJobText(job.preparedContent ?? job.content);
  };

  const saveJobContent = async (jobId: string) => {
    if (!editingJobText.trim()) {
      toast.error('Nội dung không được để trống.');
      return;
    }
    setSavingJob(true);
    try {
      const updated = await updateCampaignJobContent(jobId, editingJobText);
      setJobs(prev => prev.map(j => j.id === jobId ? updated : j));
      setEditingJobId(null);
      toast.success('Đã cập nhật nội dung bài viết!');
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err instanceof Error ? err.message : 'Không thể lưu nội dung.');
    } finally {
      setSavingJob(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!selected) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa chiến dịch "${selected.name}" không? Toàn bộ bài đăng và tiến độ trong chiến dịch này sẽ bị xóa.`)) return;
    try {
      await deleteCampaign(selected.id);
      toast.success(`Đã xóa chiến dịch "${selected.name}"`);
      setSelected(null);
      setJobs([]);
      await loadCampaigns();
    } catch {
      toast.error('Không thể xóa chiến dịch.');
    }
  };

  const handleCampaignSaved = async () => {
    setModal(false);
    setEditModal(false);
    await loadCampaigns();
    if (selected) {
      const updatedList = await listCampaigns('', 1, 100);
      const current = updatedList.items.find(c => c.id === selected.id);
      if (current) {
        await openCampaign(current);
      }
    }
  };

  const advance = async (job: CampaignJob) => {
    const action = NEXT_ACTION[job.status];
    if (!action) return;
    try {
      if (job.status === 'READY' || job.status === 'AWAITING_USER') {
        // Mở Group trước khi chuyển trạng thái
        await openFacebookGroup(job.groupUrl).catch(() => {/* nếu không mở được, vẫn cho tiếp tục */});
        if (job.status === 'READY') { toast.info(`Đã mở ${job.groupName}. Copy nội dung và đăng bài.`); }
      }
      if (job.status === 'AWAITING_USER') {
        // copy nội dung vào clipboard
        const body = job.preparedContent ?? job.content;
        await navigator.clipboard.writeText(body).catch(() => {/* clipboard không hỗ trợ trong Tauri webview cũ */});
      }
      await advanceJobStatus(job.id, action.next);
      toast.success(action.next === 'COMPLETED' ? '✅ Đã xác nhận hoàn tất' : `Đã chuyển sang: ${JOB_STATUS_LABEL[action.next]}`);
      refreshJobs();
    } catch (error) { toast.error(typeof error === 'string' ? error : error instanceof Error ? error.message : 'Không thể thực hiện thao tác.'); }
  };

  const skipJob = async (job: CampaignJob) => {
    if (!['PENDING','READY'].includes(job.status)) { toast.error('Chỉ có thể bỏ qua job đang chờ hoặc sẵn sàng.'); return; }
    try { await advanceJobStatus(job.id, 'SKIPPED'); toast.success('Đã bỏ qua job'); refreshJobs(); }
    catch { toast.error('Không thể bỏ qua job.'); }
  };

  const cancelAll = async () => {
    if (!selected) return;
    if (!window.confirm('Hủy tất cả job đang chạy trong chiến dịch này?')) return;
    try {
      const count = await cancelCampaignJobs(selected.id);
      toast.success(`Đã hủy ${count} job`); refreshJobs();
    } catch { toast.error('Không thể hủy chiến dịch.'); }
  };

  const copyContent = (job: CampaignJob) => {
    const body = job.preparedContent ?? job.content;
    void navigator.clipboard.writeText(body).then(() => toast.success('Đã copy nội dung')).catch(() => toast.error('Không thể copy'));
  };

  const runRobotAutoPost = async (job: CampaignJob) => {
    try {
      const content = job.preparedContent ?? job.content;
      // Copy vào clipboard phòng trường hợp cần paste thủ công
      await navigator.clipboard.writeText(content).catch(() => {});
      
      // Lấy hình ảnh của chiến dịch từ IndexedDB (hoặc tìm trong nội dung bài viết)
      const campaignImages = await getCampaignImages(job.campaignId);
      const imgMatch = content.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif)/i);
      
      let imgParam = '';
      if (campaignImages && campaignImages.length > 0) {
        imgParam = `&fb_img=${encodeURIComponent(campaignImages.join('|SEP|'))}`;
      } else if (imgMatch) {
        imgParam = `&fb_img=${encodeURIComponent(imgMatch[0])}`;
      }

      // Gắn payload hash vào URL để Robot Chrome Extension tự động điền và bấm Đăng
      const encoded = encodeURIComponent(content);
      const cleanUrl = job.groupUrl.split('#')[0];
      const autoUrl = `${cleanUrl}#fb_post=${encoded}${imgParam}&fb_auto=1`;

      await openUrlInBrowser(autoUrl);

      // Cập nhật trạng thái job thành AWAITING_USER để người dùng theo dõi
      if (job.status === 'PENDING' || job.status === 'READY') {
        await advanceJobStatus(job.id, 'AWAITING_USER');
      }
      toast.success(`🤖 Đã mở ${job.groupName}! Robot Extension sẽ tự động điền và bấm Đăng.`);
      refreshJobs();
    } catch (error) {
      toast.error(typeof error === 'string' ? error : error instanceof Error ? error.message : 'Không thể kích hoạt tự động đăng.');
    }
  };

  const filteredJobs = jobs.filter(j => {
    if (statusFilter && j.status !== statusFilter) return false;
    if (topicFilter && !j.groupTopic.toLowerCase().includes(topicFilter.toLowerCase())) return false;
    return true;
  });

  const pendingJobs = filteredJobs.filter(j => ['READY', 'PENDING', 'AWAITING_USER'].includes(j.status));

  const runNextAutoJob = () => {
    const next = pendingJobs[0];
    if (!next) {
      toast.info('Tất cả các job trong danh sách đã hoàn tất hoặc bị bỏ qua.');
      return;
    }
    void runRobotAutoPost(next);
  };

  const runAllPendingJobs = async () => {
    if (pendingJobs.length === 0) {
      toast.info('Tất cả các job trong danh sách đã hoàn tất hoặc bị bỏ qua.');
      return;
    }
    toast.success(`🚀 Đang mở ${pendingJobs.length} trang trên trình duyệt...`);
    for (let i = 0; i < pendingJobs.length; i++) {
      const job = pendingJobs[i];
      await runRobotAutoPost(job);
      if (i < pendingJobs.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  };

  const progressPct = stats && stats.total > 0
    ? Math.round(((stats.completed + stats.cancelled + stats.skipped) / stats.total) * 100)
    : 0;

  return (
    <>
      <div className="campaign-dashboard">
        {/* ── LEFT: Campaign List ── */}
        <aside className="campaign-sidebar">
          <div className="campaign-sidebar-head">
            <h3>Chiến dịch</h3>
            <Button onClick={() => setModal(true)}><Plus size={14} />Tạo mới</Button>
          </div>
          {campaigns.length === 0 ? (
            <div className="empty-mini">
              <span className="empty-icon"><Megaphone size={22} /></span>
              <h3>Chưa có chiến dịch</h3>
              <p>Tạo chiến dịch để lên kế hoạch nội dung.</p>
            </div>
          ) : (
            <div className="campaign-list-v2">
              {campaigns.map(c => (
                <button
                  key={c.id}
                  className={`campaign-row-v2 ${selected?.id === c.id ? 'active' : ''}`}
                  onClick={() => void openCampaign(c)}
                >
                  <span className="campaign-row-name">{c.name}</span>
                  <small>{c.groupCount} nhóm · {c.postCount} bài</small>
                  <span className={`status-chip ${c.status}`}>{c.status}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* ── CENTER: Job Table ── */}
        <main className="campaign-center">
          {!selected ? (
            <div className="empty-state">
              <span className="empty-icon"><Megaphone size={28} /></span>
              <h2>Chọn chiến dịch để xem tiến độ</h2>
              <p>Bảng điều khiển chiến dịch giúp bạn theo dõi từng nhóm và xác nhận kết quả đăng bài.</p>
            </div>
          ) : (
            <>
              <div className="campaign-center-head">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h2>{selected.name}</h2>
                    {selectedCampaignImages.length > 0 && (
                      <span className="status-chip teal" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ImageIcon size={11} /> {selectedCampaignImages.length} ảnh kèm theo
                      </span>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setEditModal(true)}
                      style={{ fontSize: 11, padding: '3px 8px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      title="Chỉnh sửa thông tin, nội dung, ảnh và các nhóm của chiến dịch"
                    >
                      <Pencil size={11} /> Sửa chiến dịch
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => void handleDeleteCampaign()}
                      style={{ fontSize: 11, padding: '3px 8px', height: 'auto', color: 'var(--muted)' }}
                      title="Xóa chiến dịch này"
                    >
                      <Trash2 size={11} /> Xóa
                    </Button>
                  </div>
                  <p className="muted">Hỗ trợ 2 chế độ: 🤖 Robot tự động đăng qua Chrome Extension, hoặc Đăng thủ công có trợ lý.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Button className="robot-auto-btn" onClick={runNextAutoJob} title="Mở job tiếp theo để Robot tự động đăng">
                    <Bot size={13} /> Chạy Robot Job tiếp theo
                  </Button>
                  {pendingJobs.length > 1 && (
                    <Button
                      className="robot-auto-btn"
                      style={{ background: '#1c7562' }}
                      onClick={() => void runAllPendingJobs()}
                      title="Mở tất cả các tab Fanpage/Nhóm cùng lúc để Robot tự động đăng"
                    >
                      <Rocket size={13} /> Mở tất cả ({pendingJobs.length} trang)
                    </Button>
                  )}
                  <Button variant="outline" onClick={refreshJobs}><RefreshCw size={14} />Làm mới</Button>
                  <Button variant="outline" onClick={cancelAll}><X size={14} />Hủy tất cả</Button>
                </div>
              </div>

              {/* Filters */}
              <div className="job-filters">
                <label>Lọc theo chủ đề
                  <input value={topicFilter} onChange={e => setTopicFilter(e.target.value)} placeholder="Tất cả chủ đề" />
                </label>
                <label>Trạng thái
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as JobStatus | '')}>
                    <option value="">Tất cả</option>
                    {(Object.keys(JOB_STATUS_LABEL) as JobStatus[]).map(s => (
                      <option key={s} value={s}>{JOB_STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Mode notice */}
              <div className="notice" style={{ marginBottom: 16 }}>
                <Bot size={16} />
                <span>
                  <strong>Chế độ đăng bài:</strong> Bấm <strong>🤖 Tự động đăng</strong> để mở Chrome, Robot Extension sẽ tự động mở ô viết bài, gõ nội dung và bấm Đăng từng bước; hoặc bấm <strong>Mở thủ công</strong> để tự dán bài.
                </span>
              </div>

              {loadingJobs ? (
                <div className="loading"><Loader2 className="spin" size={20} /> Đang tải jobs…</div>
              ) : (
                <div className="job-table">
                  {filteredJobs.map(job => (
                    <div key={job.id} className={`job-row ${expandedJob === job.id ? 'expanded' : ''}`}>
                      <div className="job-row-main" onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}>
                        <span className="job-group-name">
                          {expandedJob === job.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <strong>{job.groupName}</strong>
                          {job.groupTopic && <small className="subtle-pill" style={{ marginLeft: 6 }}>{job.groupTopic}</small>}
                        </span>
                        <span className={`status-chip ${JOB_STATUS_COLOR[job.status]}`}>
                          {JOB_STATUS_LABEL[job.status]}
                        </span>
                        <div className="job-actions">
                          {['PENDING', 'PREPARING', 'READY', 'AWAITING_USER'].includes(job.status) && (
                            <Button
                              className="robot-auto-btn"
                              title="Robot tự động mở trang, gõ nội dung và bấm Đăng"
                              onClick={e => { e.stopPropagation(); void runRobotAutoPost(job); }}
                            >
                              <Bot size={13} /> Tự động đăng (Robot)
                            </Button>
                          )}
                          {NEXT_ACTION[job.status] && (
                            <Button variant="outline" onClick={e => { e.stopPropagation(); void advance(job); }}>
                              {job.status === 'AWAITING_USER' ? <CheckCheck size={14} /> : <ExternalLink size={14} />}
                              {NEXT_ACTION[job.status]!.label}
                            </Button>
                          )}
                          {(job.status === 'PENDING' || job.status === 'READY') && (
                            <Button size="icon" variant="ghost" aria-label="Bỏ qua" title="Bỏ qua nhóm này" onClick={e => { e.stopPropagation(); void skipJob(job); }}>
                              <SkipForward size={14} />
                            </Button>
                          )}
                        </div>
                      </div>

                      {expandedJob === job.id && (
                        <div className="job-detail">
                          <div className="job-detail-content">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                              <strong style={{ fontSize: 11 }}>Nội dung bài đăng</strong>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {editingJobId === job.id ? (
                                  <>
                                    <Button disabled={savingJob} onClick={() => void saveJobContent(job.id)} style={{ fontSize: 11, padding: '3px 8px', height: 'auto' }}>
                                      {savingJob ? 'Đang lưu…' : 'Lưu nội dung'}
                                    </Button>
                                    <Button variant="outline" onClick={() => setEditingJobId(null)} style={{ fontSize: 11, padding: '3px 8px', height: 'auto' }}>
                                      Hủy
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button variant="outline" onClick={() => startEditJobContent(job)} style={{ fontSize: 11, padding: '3px 8px', height: 'auto' }} title="Chỉnh sửa nội dung cho riêng bài đăng này">
                                      <Pencil size={12} /> Sửa nội dung
                                    </Button>
                                    <Button variant="outline" onClick={() => copyContent(job)} style={{ fontSize: 11, padding: '3px 8px', height: 'auto' }}>
                                      <Copy size={12} /> Copy nội dung
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            {editingJobId === job.id ? (
                              <textarea
                                className="draft-edit-textarea"
                                value={editingJobText}
                                onChange={e => setEditingJobText(e.target.value)}
                                rows={6}
                                style={{ width: '100%', marginBottom: 10, fontSize: 11 }}
                              />
                            ) : (
                              <pre className="post-content-preview">{job.preparedContent ?? job.content}</pre>
                            )}
                            {selectedCampaignImages.length > 0 && (
                              <div style={{ marginTop: 10 }}>
                                <strong style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
                                  📷 Hình ảnh đính kèm bài viết ({selectedCampaignImages.length} ảnh):
                                </strong>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {selectedCampaignImages.map((src, i) => (
                                    <img
                                      key={i}
                                      src={src}
                                      alt={`Ảnh đính kèm ${i + 1}`}
                                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="job-meta">
                            <div><span>URL Group</span><a href={job.groupUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 10 }}>{job.groupUrl}</a></div>
                            {job.retryCount > 0 && <div><span>Số lần thử</span><strong>{job.retryCount}</strong></div>}
                            {job.errorMessage && <div className="job-error"><AlertTriangle size={13} />{job.errorMessage}</div>}
                            {job.completedAt && <div><span>Hoàn tất lúc</span><strong>{new Date(job.completedAt).toLocaleString('vi-VN')}</strong></div>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <Button className="robot-auto-btn" onClick={() => void runRobotAutoPost(job)}>
                              <Bot size={13} /> Tự động đăng qua Robot
                            </Button>
                            <Button variant="outline" onClick={() => void openFacebookGroup(job.groupUrl).catch(() => toast.error('Không thể mở Group/Trang.'))}>
                              <ExternalLink size={13} />Mở thủ công
                            </Button>
                            {job.status === 'FAILED' && (
                              <Button variant="outline" onClick={() => void advanceJobStatus(job.id, 'CANCELLED').then(() => { toast.success('Đã hủy job'); refreshJobs(); })}>
                                <Ban size={13} />Hủy job này
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredJobs.length === 0 && (
                    <div className="empty-mini"><h3>Không có job nào khớp bộ lọc</h3></div>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* ── RIGHT: Stats Panel ── */}
        <aside className="campaign-stats">
          {selected && stats ? (
            <>
              <h3>Thống kê chiến dịch</h3>
              <div className="stat-row total"><span>Tổng nhóm</span><strong>{stats.total}</strong></div>
              <div className="stat-row"><span>Chờ xử lý</span><strong>{stats.pending}</strong></div>
              <div className="stat-row blue"><span>Đang chuẩn bị</span><strong>{stats.preparing}</strong></div>
              <div className="stat-row teal"><span>Sẵn sàng</span><strong>{stats.ready}</strong></div>
              <div className="stat-row amber"><span>Chờ bạn đăng</span><strong>{stats.awaitingUser}</strong></div>
              <div className="stat-row allowed"><span>Hoàn tất</span><strong>{stats.completed}</strong></div>
              <div className="stat-row prohibited"><span>Thất bại</span><strong>{stats.failed}</strong></div>
              <div className="stat-row muted-row"><span>Đã hủy</span><strong>{stats.cancelled}</strong></div>
              <div className="stat-row muted-row"><span>Bỏ qua</span><strong>{stats.skipped}</strong></div>
              <div className="progress-section">
                <div className="progress-label">
                  <span>Tiến độ</span><strong>{progressPct}%</strong>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
              <div className="publishing-note">
                <Clock size={14} />
                <span>Chỉ đánh dấu COMPLETED sau khi bạn xác nhận đã đăng thực tế.</span>
              </div>
            </>
          ) : (
            <div className="empty-mini">
              <span className="empty-icon"><ChevronDown size={22} /></span>
              <p>Chọn chiến dịch để xem thống kê</p>
            </div>
          )}
        </aside>
      </div>

      {modal && (
        <CampaignForm
          onClose={() => setModal(false)}
          onSaved={async () => { setModal(false); await loadCampaigns(); }}
        />
      )}

      {editModal && selected && (
        <CampaignForm
          campaign={selected}
          initialContent={jobs[0]?.content || ''}
          initialImages={selectedCampaignImages}
          initialGroupIds={jobs.map(j => j.groupId)}
          onClose={() => setEditModal(false)}
          onSaved={handleCampaignSaved}
        />
      )}
    </>
  );
}

function CampaignForm({
  campaign,
  initialContent = '',
  initialImages = [],
  initialGroupIds = [],
  onClose,
  onSaved,
}: {
  campaign?: Campaign;
  initialContent?: string;
  initialImages?: string[];
  initialGroupIds?: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [form, setForm] = useState<CampaignInput>(() => {
    if (campaign) {
      return {
        name: campaign.name,
        objective: campaign.objective,
        audience: campaign.audience,
        startsAt: campaign.startsAt ?? undefined,
        endsAt: campaign.endsAt ?? undefined,
        notes: campaign.notes,
        groupIds: initialGroupIds,
        content: initialContent,
      };
    }
    return empty;
  });
  const [busy, setBusy] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [images, setImages] = useState<string[]>(initialImages);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listGroups('', '', false, false, 1, 100)
      .then(r => setGroups(r.items.filter(g => !g.blacklisted)))
      .catch(() => toast.error('Không thể tải nhóm.'));
  }, []);

  const processFiles = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    if (rawFiles.length === 0) return;

    const validFiles = rawFiles.filter(isImageFile);
    if (validFiles.length === 0) {
      toast.error('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, JPEG, WEBP, GIF).');
      return;
    }

    setCompressing(true);
    try {
      const newImages: string[] = [];
      for (const file of validFiles) {
        const dataUrl = await compressImageToDataUrl(file);
        if (dataUrl) newImages.push(dataUrl);
      }

      if (newImages.length > 0) {
        setImages(prev => [...prev, ...newImages]);
        toast.success(`Đã thêm ${newImages.length} ảnh`);
      } else {
        toast.error('Không thể đọc file hình ảnh đã chọn.');
      }
    } catch (err) {
      console.error('Lỗi khi nén ảnh:', err);
      toast.error('Không thể xử lý hình ảnh.');
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      void processFiles(e.target.files);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      if (campaign) {
        await updateCampaign(campaign.id, form);
        await saveCampaignImages(campaign.id, images);
        toast.success(`Đã cập nhật chiến dịch "${form.name}"`);
      } else {
        const created = await createCampaign(form);
        if (images.length > 0) {
          await saveCampaignImages(created.id, images);
        }
        toast.success(`Đã tạo chiến dịch${images.length > 0 ? ` kèm ${images.length} ảnh` : ''}`);
      }
      await onSaved();
    }
    catch (error) { toast.error(typeof error === 'string' ? error : error instanceof Error ? error.message : 'Không thể lưu chiến dịch.'); }
    finally { setBusy(false); }
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
    (g.topic && g.topic.toLowerCase().includes(groupSearch.toLowerCase()))
  );

  const toggleGroup = (id: string) =>
    setForm(prev => ({
      ...prev,
      groupIds: prev.groupIds.includes(id)
        ? prev.groupIds.filter(gid => gid !== id)
        : [...prev.groupIds, id],
    }));

  const groupsByTopic = filteredGroups.reduce<Record<string, Group[]>>((acc, g) => {
    const key = g.topic || 'Chưa phân loại';
    (acc[key] ??= []).push(g); return acc;
  }, {});

  return (
    <Modal title={campaign ? `Chỉnh sửa chiến dịch: ${campaign.name}` : 'Tạo chiến dịch'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Tên chiến dịch<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <div className="form-grid">
          <label>Mục tiêu<input value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })} /></label>
          <label>Nhóm đối tượng<input value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} /></label>
        </div>
        <label>Nội dung bài viết<textarea required rows={5} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></label>

        {/* ── Khu vực đính kèm hình ảnh (Dùng div thay vì label để tránh kích hoạt double click) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 10, fontWeight: 600, marginBottom: 15 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ImageIcon size={13} /> Hình ảnh đính kèm bài viết ({images.length} ảnh)
            </span>
            {images.length > 0 && (
              <button
                type="button"
                style={{ fontSize: 10, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => setImages([])}
              >
                Xóa tất cả
              </button>
            )}
          </div>
          <div
            className="campaign-image-dropzone"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              if (e.dataTransfer.files) {
                void processFiles(e.dataTransfer.files);
              }
            }}
            onClick={e => {
              const target = e.target as HTMLElement;
              if (target.closest('.campaign-image-remove') || target.closest('.campaign-image-add-btn')) return;
              fileInputRef.current?.click();
            }}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
            {images.length === 0 ? (
              <div className="campaign-image-prompt">
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                  {compressing ? 'Đang nén ảnh...' : '➕ Bấm để chọn ảnh từ máy tính (hoặc kéo thả vào đây)'}
                </span>
                <span className="muted" style={{ fontSize: 10 }}>Tự động đăng kèm bài viết Facebook (JPG, PNG, WEBP)</span>
              </div>
            ) : (
              <div className="campaign-image-list">
                {images.map((img, idx) => (
                  <div key={idx} className="campaign-image-item" onClick={e => e.stopPropagation()}>
                    <img src={img} alt={`Ảnh ${idx + 1}`} />
                    <button
                      type="button"
                      className="campaign-image-remove"
                      title="Xóa ảnh này"
                      onClick={e => {
                        e.stopPropagation();
                        setImages(prev => prev.filter((_, i) => i !== idx));
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="campaign-image-add-btn"
                  title="Thêm ảnh khác"
                  disabled={compressing}
                  onClick={e => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  {compressing ? '…' : '＋'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="form-grid">
          <label>Ngày bắt đầu<input type="date" value={form.startsAt ?? ''} onChange={e => setForm({ ...form, startsAt: e.target.value || undefined })} /></label>
          <label>Ngày kết thúc<input type="date" value={form.endsAt ?? ''} onChange={e => setForm({ ...form, endsAt: e.target.value || undefined })} /></label>
        </div>
        <label>Ghi chú<textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>

        <label>
          Chọn nhóm <span className="muted">({form.groupIds.length}/{groups.length} đã chọn)</span>
          <input
            style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 6, padding: '6px 9px' }}
            placeholder="Tìm theo tên hoặc chủ đề…"
            value={groupSearch}
            onChange={e => setGroupSearch(e.target.value)}
          />
          <div className="group-picker">
            {Object.entries(groupsByTopic).map(([topicKey, groupList]) => (
              <div key={topicKey} className="group-topic-section">
                <div className="group-topic-label">{topicKey} ({groupList.length})</div>
                {groupList.map(g => (
                  <label key={g.id} className="check-label">
                    <input type="checkbox" checked={form.groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                    {g.name}
                    {g.advertising === 'allowed' && <span className="status-chip allowed" style={{ marginLeft: 4 }}>Ads ✓</span>}
                  </label>
                ))}
              </div>
            ))}
            {filteredGroups.length === 0 && <p className="muted" style={{ padding: 8, fontSize: 11 }}>Không tìm thấy nhóm.</p>}
          </div>
        </label>

        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button disabled={busy || form.groupIds.length === 0}>
            {busy ? 'Đang lưu…' : campaign ? 'Lưu thay đổi' : `Tạo chiến dịch (${form.groupIds.length} nhóm)`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
