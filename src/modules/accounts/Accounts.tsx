/* eslint-disable react-hooks/exhaustive-deps -- loader is intentionally debounced by query and page. */
import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Link2, Pencil, Plus, Search, Trash2, Unlink, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import type { Account, AccountCategory, AccountGroupInput, AccountInput, Group, MembershipStatus } from '../../types';
import { createAccount, deleteAccounts, linkAccountGroup, listAccountGroups, listAccounts, openUrlInBrowser, unlinkAccountGroup, updateAccount } from '../../services/database';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/Modal';

const CATEGORY_LABELS: Record<AccountCategory, string> = {
  personal: 'Cá nhân', business: 'Doanh nghiệp', page: 'Fanpage', other: 'Khác',
};
const empty: AccountInput = { name: '', notes: '', connectionStatus: 'unconfirmed', category: 'personal' };

export function Accounts() {
  const [items, setItems] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<Account | null | undefined>();
  const [loading, setLoading] = useState(true);
  const [linkModal, setLinkModal] = useState<Account | null>(null);

  const load = async () => {
    setLoading(true);
    try { const data = await listAccounts(query, page); setItems(data.items); setTotal(data.total); setSelected([]); }
    catch { toast.error('Không thể tải danh sách tài khoản.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { const timer = window.setTimeout(() => void load(), 220); return () => window.clearTimeout(timer); }, [query, page]);

  const remove = async () => {
    if (!selected.length) return;
    try { await deleteAccounts(selected); toast.success(`Đã xóa ${selected.length} tài khoản`); await load(); }
    catch { toast.error('Không thể xóa tài khoản.'); }
  };

  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);

  const openFacebook = (name: string) => {
    const url = `https://www.facebook.com/search/top?q=${encodeURIComponent(name)}`;
    void openUrlInBrowser(url).catch(() => toast.error('Không thể mở trình duyệt.'));
  };

  return (
    <>
      <section className="card list-card">
        <div className="list-toolbar">
          <label className="search">
            <Search size={16} />
            <input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Tìm theo tên hoặc ghi chú" />
          </label>
          <div className="toolbar-actions">
            {selected.length > 0 && (
              <Button variant="outline" onClick={() => void remove()}>
                <Trash2 size={16} />Xóa ({selected.length})
              </Button>
            )}
            <Button onClick={() => setModal(null)}>
              <Plus size={16} />Thêm tài khoản
            </Button>
          </div>
        </div>
        <div className="permission-note">
          <CheckCircle2 size={16} />
          <span>Không lưu mật khẩu, cookie hay mã 2FA. Trạng thái kết nối do bạn trực tiếp xác nhận.</span>
        </div>
        {loading ? (
          <div className="loading">Đang tải tài khoản…</div>
        ) : items.length === 0 ? (
          <Empty onAdd={() => setModal(null)} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={items.length > 0 && selected.length === items.length} onChange={() => setSelected(selected.length === items.length ? [] : items.map(i => i.id))} /></th>
                <th>Tài khoản</th>
                <th>Phân loại</th>
                <th>Trạng thái</th>
                <th>Nhóm</th>
                <th>Ghi chú</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} /></td>
                  <td>
                    <div className="entity-title">
                      <span className="entity-avatar">{item.name.slice(0, 1).toUpperCase()}</span>
                      <strong>{item.name}</strong>
                    </div>
                  </td>
                  <td><span className="subtle-pill">{CATEGORY_LABELS[item.category] ?? item.category}</span></td>
                  <td>
                    <span className={`status-chip ${item.connectionStatus}`}>
                      {item.connectionStatus === 'confirmed' ? 'Đã xác nhận' : 'Chưa xác nhận'}
                    </span>
                  </td>
                  <td>
                    <button className="group-count-btn" onClick={() => setLinkModal(item)} title="Quản lý nhóm liên kết">
                      {item.groupCount} nhóm
                    </button>
                  </td>
                  <td className="muted cell-truncate">{item.notes || '—'}</td>
                  <td>
                    <Button size="icon" variant="ghost" aria-label={`Tìm ${item.name} trên Facebook`} onClick={() => openFacebook(item.name)} title="Mở Facebook trong trình duyệt">
                      <ExternalLink size={16} />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Quản lý nhóm của ${item.name}`} onClick={() => setLinkModal(item)}>
                      <Link2 size={16} />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Sửa ${item.name}`} onClick={() => setModal(item)}>
                      <Pencil size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} total={total} onChange={setPage} />
      </section>

      {modal !== undefined && (
        <AccountForm
          account={modal ?? undefined}
          onClose={() => setModal(undefined)}
          onSaved={async () => { setModal(undefined); await load(); }}
        />
      )}
      {linkModal && (
        <AccountGroupsModal
          account={linkModal}
          onClose={() => { setLinkModal(null); void load(); }}
        />
      )}
    </>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><UsersRound size={28} /></span>
      <h2>Chưa có tài khoản</h2>
      <p>Thêm tên và ghi chú cho những tài khoản bạn sở hữu hoặc được phép sử dụng.</p>
      <Button onClick={onAdd}><Plus size={16} />Thêm tài khoản đầu tiên</Button>
    </div>
  );
}

function AccountForm({ account, onClose, onSaved }: { account?: Account; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<AccountInput>(
    account
      ? { name: account.name, notes: account.notes, connectionStatus: account.connectionStatus, category: account.category }
      : empty
  );
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (account) await updateAccount(account.id, form);
      else await createAccount(form);
      toast.success(account ? 'Đã cập nhật tài khoản' : 'Đã thêm tài khoản');
      await onSaved();
    } catch (error) {
      toast.error(typeof error === 'string' ? error : error instanceof Error ? error.message : 'Không thể lưu tài khoản.');
    } finally { setBusy(false); }
  };

  return (
    <Modal title={account ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản Facebook'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Tên tài khoản<input autoFocus required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <div className="form-grid">
          <label>Phân loại
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as AccountInput['category'] })}>
              <option value="personal">Cá nhân</option>
              <option value="business">Doanh nghiệp</option>
              <option value="page">Fanpage</option>
              <option value="other">Khác</option>
            </select>
          </label>
          <label>Trạng thái do bạn xác nhận
            <select value={form.connectionStatus} onChange={e => setForm({ ...form, connectionStatus: e.target.value as AccountInput['connectionStatus'] })}>
              <option value="unconfirmed">Chưa xác nhận</option>
              <option value="confirmed">Đã xác nhận</option>
            </select>
          </label>
        </div>
        <label>Ghi chú<textarea maxLength={2000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu tài khoản'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function AccountGroupsModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setGroups(await listAccountGroups(account.id)); }
    catch { toast.error('Không thể tải danh sách nhóm.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [account.id]);

  const unlink = async (groupId: string, groupName: string) => {
    try {
      await unlinkAccountGroup(account.id, groupId);
      toast.success(`Đã hủy liên kết với ${groupName}`);
      void load();
    } catch { toast.error('Không thể hủy liên kết.'); }
  };

  const updateMembership = async (groupId: string, membership: MembershipStatus) => {
    try {
      const input: AccountGroupInput = { accountId: account.id, groupId, membership };
      await linkAccountGroup(input);
      toast.success('Đã cập nhật membership');
      void load();
    } catch { toast.error('Không thể cập nhật membership.'); }
  };

  return (
    <Modal title={`Nhóm liên kết — ${account.name}`} onClose={onClose}>
      <div style={{ padding: '16px 20px' }}>
        <p className="muted">Các Facebook Group bạn đã liên kết với tài khoản này.</p>
        {loading ? <div className="loading">Đang tải…</div> : groups.length === 0 ? (
          <div className="empty-mini">
            <span className="empty-icon"><UsersRound size={22} /></span>
            <h3>Chưa có nhóm liên kết</h3>
            <p>Mở Quản lý nhóm và chọn nhóm để liên kết với tài khoản.</p>
          </div>
        ) : (
          <div className="linked-groups-list">
            {groups.map(g => (
              <div key={g.id} className="linked-group-row">
                <div>
                  <strong>{g.name}</strong>
                  <small className="url-text">{g.url}</small>
                </div>
                <select
                  className="membership-select"
                  defaultValue="joined"
                  onChange={e => void updateMembership(g.id, e.target.value as MembershipStatus)}
                >
                  <option value="unconfirmed">Chưa xác nhận</option>
                  <option value="joined">Đã tham gia</option>
                  <option value="not_joined">Chưa tham gia</option>
                </select>
                <Button size="icon" variant="ghost" aria-label={`Hủy liên kết ${g.name}`} onClick={() => void unlink(g.id, g.name)}>
                  <Unlink size={15} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="form-actions" style={{ padding: '0 20px 20px', borderTop: 'none' }}>
        <Button variant="outline" onClick={onClose}>Đóng</Button>
      </div>
    </Modal>
  );
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <footer className="list-footer">
      <span>{total} tài khoản</span>
      <span className="pager">
        <Button size="icon" variant="ghost" disabled={page === 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></Button>
        Trang {page}/{pages}
        <Button size="icon" variant="ghost" disabled={page === pages} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></Button>
      </span>
    </footer>
  );
}
