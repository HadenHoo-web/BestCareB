/* eslint-disable react-hooks/exhaustive-deps -- loader is intentionally debounced by filters and page. */
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Ban, ChevronLeft, ChevronRight, ExternalLink, FileDown, FileUp, Heart, Link2, Pencil, Plus, Search, Star, Trash2, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import type { Account, AccountGroupInput, BulkEditGroupInput, Group, GroupImportRow, GroupInput } from '../../types';
import {
  bulkEditGroups, createGroup, deleteGroups, importGroups, linkAccountGroup,
  listAccounts, listGroups, openFacebookGroup, updateGroup,
} from '../../services/database';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/Modal';

const empty: GroupInput = { url: '', name: '', description: '', topic: '', rules: '', advertising: 'unknown', favorite: false, blacklisted: false };

export function Groups() {
  const [items, setItems] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [showBlacklisted, setShowBlacklisted] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<Group | null | undefined>();
  const [loading, setLoading] = useState(true);
  const [bulkModal, setBulkModal] = useState(false);
  const [linkAccountModal, setLinkAccountModal] = useState<Group | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listGroups(query, topic, favoriteOnly, showBlacklisted, page);
      setItems(data.items); setTotal(data.total); setSelected([]);
    } catch { toast.error('Không thể tải danh sách nhóm.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 220);
    return () => window.clearTimeout(timer);
  }, [query, topic, favoriteOnly, showBlacklisted, page]);

  const remove = async () => {
    try { await deleteGroups(selected); toast.success(`Đã xóa ${selected.length} nhóm`); await load(); }
    catch { toast.error('Không thể xóa nhóm.'); }
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) { toast.error('CSV chưa có URL nhóm hợp lệ.'); return; }
      const result = await importGroups(rows);
      toast.success(`Đã nhập ${result.imported} nhóm; bỏ qua ${result.skipped} dòng.`);
      await load();
    } catch { toast.error('Không thể đọc hoặc nhập tệp CSV.'); }
  };

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <>
      <section className="card list-card">
        <div className="list-toolbar">
          <label className="search">
            <Search size={16} />
            <input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Tìm tên, URL hoặc chủ đề" />
          </label>
          <div className="toolbar-actions">
            <input ref={inputRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={importFile} />
            <Button variant="outline" onClick={() => inputRef.current?.click()}><FileUp size={16} />Nhập CSV</Button>
            <Button variant="outline" onClick={() => exportCsv(items)} disabled={!items.length}><FileDown size={16} />Xuất trang này</Button>
            {selected.length > 0 && (
              <>
                <Button variant="outline" onClick={() => setBulkModal(true)}><Pencil size={16} />Sửa hàng loạt ({selected.length})</Button>
                <Button variant="outline" onClick={() => void remove()}><Trash2 size={16} />Xóa ({selected.length})</Button>
              </>
            )}
            <Button onClick={() => setModal(null)}><Plus size={16} />Thêm nhóm</Button>
          </div>
        </div>

        <div className="filter-row">
          <label>Chủ đề
            <input value={topic} onChange={e => { setTopic(e.target.value); setPage(1); }} placeholder="Tất cả chủ đề" />
          </label>
          <label className="favorite-filter">
            <input type="checkbox" checked={favoriteOnly} onChange={e => { setFavoriteOnly(e.target.checked); setPage(1); }} />
            <Star size={15} /> Chỉ yêu thích
          </label>
          <label className="favorite-filter">
            <input type="checkbox" checked={showBlacklisted} onChange={e => { setShowBlacklisted(e.target.checked); setPage(1); }} />
            <Ban size={15} /> Xem danh sách đen
          </label>
        </div>

        {loading ? (
          <div className="loading">Đang tải danh sách nhóm…</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon"><UsersRound size={28} /></span>
            <h2>Chưa có Facebook Group hoặc Fanpage</h2>
            <p>Thêm từng URL hoặc nhập danh sách CSV. URL trùng sẽ được bỏ qua.</p>
            <Button onClick={() => setModal(null)}><Plus size={16} />Thêm kênh đầu tiên</Button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={items.length > 0 && selected.length === items.length} onChange={() => setSelected(selected.length === items.length ? [] : items.map(i => i.id))} /></th>
                <th>Nhóm / Fanpage</th>
                <th>Chủ đề</th>
                <th>Quảng cáo</th>
                <th>Trạng thái</th>
                <th>Lần cuối dùng</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className={item.blacklisted ? 'blacklisted-row' : ''}>
                  <td><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)} /></td>
                  <td>
                    <strong>{item.name}</strong>
                    {item.blacklisted && <span className="blacklist-badge">Danh sách đen</span>}
                    <small className="url-text">{item.url}</small>
                  </td>
                  <td>{item.topic || '—'}</td>
                  <td><span className={`status-chip ${item.advertising}`}>{labelAdvertising(item.advertising)}</span></td>
                  <td>
                    {item.favorite && <Heart className="favorite" size={14} fill="currentColor" />}
                  </td>
                  <td className="muted" style={{ fontSize: 10 }}>{item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString('vi-VN') : '—'}</td>
                  <td className="row-actions">
                    <Button size="icon" variant="ghost" aria-label={`Mở ${item.name} trong trình duyệt`}
                      onClick={() => void openFacebookGroup(item.url).catch(() => toast.error('Không thể mở nhóm trong trình duyệt.'))}>
                      <ExternalLink size={16} />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Liên kết tài khoản với ${item.name}`} onClick={() => setLinkAccountModal(item)}>
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

        <footer className="list-footer">
          <span>{total} nhóm</span>
          <span className="pager">
            <Button size="icon" variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></Button>
            Trang {page}/{pages}
            <Button size="icon" variant="ghost" disabled={page === pages} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></Button>
          </span>
        </footer>
      </section>

      {modal !== undefined && (
        <GroupForm group={modal ?? undefined} onClose={() => setModal(undefined)} onSaved={async () => { setModal(undefined); await load(); }} />
      )}
      {bulkModal && (
        <BulkEditModal ids={selected} onClose={() => setBulkModal(false)} onSaved={async () => { setBulkModal(false); await load(); }} />
      )}
      {linkAccountModal && (
        <LinkAccountModal group={linkAccountModal} onClose={() => setLinkAccountModal(null)} />
      )}
    </>
  );
}

function GroupForm({ group, onClose, onSaved }: { group?: Group; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<GroupInput>(
    group
      ? { url: group.url, name: group.name, description: group.description, topic: group.topic, rules: group.rules, advertising: group.advertising, favorite: group.favorite, blacklisted: group.blacklisted }
      : empty
  );
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      if (group) await updateGroup(group.id, form);
      else await createGroup(form);
      toast.success(group ? 'Đã cập nhật nhóm' : 'Đã thêm nhóm');
      await onSaved();
    } catch (error) { toast.error(typeof error === 'string' ? error : error instanceof Error ? error.message : 'Không thể lưu nhóm.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={group ? 'Chỉnh sửa Facebook Group / Fanpage' : 'Thêm Facebook Group / Fanpage'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>URL Facebook Group / Fanpage
          <input autoFocus required value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://www.facebook.com/groups/... hoặc https://www.facebook.com/ten-fanpage" />
        </label>
        <label>Tên nhóm / Fanpage
          <input required maxLength={180} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </label>
        <div className="form-grid">
          <label>Chủ đề<input maxLength={100} value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} /></label>
          <label>Quảng cáo
            <select value={form.advertising} onChange={e => setForm({ ...form, advertising: e.target.value as GroupInput['advertising'] })}>
              <option value="unknown">Chưa rõ</option>
              <option value="allowed">Cho phép</option>
              <option value="prohibited">Không cho phép</option>
            </select>
          </label>
        </div>
        <label>Mô tả<textarea maxLength={2000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        <label>Quy định đăng bài<textarea maxLength={4000} value={form.rules} onChange={e => setForm({ ...form, rules: e.target.value })} /></label>
        <div style={{ display: 'flex', gap: 20 }}>
          <label className="check-label">
            <input type="checkbox" checked={form.favorite} onChange={e => setForm({ ...form, favorite: e.target.checked })} /> Đánh dấu yêu thích
          </label>
          <label className="check-label">
            <input type="checkbox" checked={form.blacklisted} onChange={e => setForm({ ...form, blacklisted: e.target.checked })} /> Thêm vào danh sách đen
          </label>
        </div>
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu nhóm'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function BulkEditModal({ ids, onClose, onSaved }: { ids: string[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [topic, setTopic] = useState('');
  const [advertising, setAdvertising] = useState('');
  const [blacklisted, setBlacklisted] = useState<'' | 'true' | 'false'>('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const input: BulkEditGroupInput = { ids };
      if (topic.trim()) input.topic = topic.trim();
      if (advertising) input.advertising = advertising as GroupInput['advertising'];
      if (blacklisted !== '') input.blacklisted = blacklisted === 'true';
      const count = await bulkEditGroups(input);
      toast.success(`Đã cập nhật ${count} nhóm`);
      await onSaved();
    } catch (error) { toast.error(typeof error === 'string' ? error : error instanceof Error ? error.message : 'Không thể cập nhật nhóm.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={`Chỉnh sửa hàng loạt — ${ids.length} nhóm đã chọn`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted">Chỉ các trường có giá trị sẽ được cập nhật. Để trống = giữ nguyên.</p>
        <label>Chủ đề mới (áp dụng cho tất cả)
          <input maxLength={100} value={topic} onChange={e => setTopic(e.target.value)} placeholder="Để trống để giữ nguyên" />
        </label>
        <label>Quảng cáo
          <select value={advertising} onChange={e => setAdvertising(e.target.value)}>
            <option value="">Giữ nguyên</option>
            <option value="unknown">Chưa rõ</option>
            <option value="allowed">Cho phép</option>
            <option value="prohibited">Không cho phép</option>
          </select>
        </label>
        <label>Danh sách đen
          <select value={blacklisted} onChange={e => setBlacklisted(e.target.value as '' | 'true' | 'false')}>
            <option value="">Giữ nguyên</option>
            <option value="true">Thêm vào danh sách đen</option>
            <option value="false">Xóa khỏi danh sách đen</option>
          </select>
        </label>
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button disabled={busy}>{busy ? 'Đang cập nhật…' : 'Cập nhật'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function LinkAccountModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void listAccounts('', 1, 100).then(r => { setAccounts(r.items); setLoading(false); });
  }, []);

  const link = async (accountId: string) => {
    setBusy(accountId);
    try {
      const input: AccountGroupInput = { accountId, groupId: group.id, membership: 'joined' };
      await linkAccountGroup(input);
      toast.success('Đã liên kết với tài khoản');
    } catch { toast.error('Không thể liên kết.'); }
    finally { setBusy(null); }
  };

  return (
    <Modal title={`Liên kết tài khoản — ${group.name}`} onClose={onClose}>
      <div style={{ padding: '16px 20px' }}>
        <p className="muted">Liên kết nhóm này với một tài khoản để quản lý theo tài khoản.</p>
        {loading ? <div className="loading">Đang tải…</div> : accounts.length === 0 ? (
          <p className="muted">Chưa có tài khoản. Hãy thêm tài khoản trước.</p>
        ) : (
          <div className="linked-groups-list">
            {accounts.map(a => (
              <div key={a.id} className="linked-group-row">
                <div>
                  <strong>{a.name}</strong>
                  <small className="url-text">{a.category}</small>
                </div>
                <Button size="icon" variant="ghost" disabled={busy === a.id} onClick={() => void link(a.id)}>
                  <Link2 size={15} />
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

// ─── CSV helpers ──────────────────────────────────────────────────────────────
function parseCsv(source: string): GroupImportRow[] {
  const [header, ...rows] = source.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!header) return [];
  const columns = split(header).map(v => v.trim().toLowerCase());
  const index = (...names: string[]) => columns.findIndex(c => names.includes(c));
  const urlIndex = index('url', 'group_url', 'group url', 'link');
  if (urlIndex < 0) return [];
  return rows.map(line => {
    const cells = split(line);
    const value = (...names: string[]) => { const at = index(...names); return at >= 0 ? cells[at]?.trim() : undefined; };
    const favorite = value('favorite', 'yêu thích');
    return {
      url: cells[urlIndex]?.trim() ?? '', name: value('name', 'tên', 'group_name'),
      description: value('description', 'mô tả'), topic: value('topic', 'chủ đề'),
      rules: value('rules', 'quy định'),
      advertising: value('advertising', 'quảng cáo') as GroupImportRow['advertising'],
      favorite: favorite === '1' || favorite?.toLowerCase() === 'true',
    };
  }).filter(row => row.url);
}

function split(line: string) {
  const cells: string[] = []; let cell = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { cell += '"'; i++; }
    else if (char === '"') { quoted = !quoted; }
    else if (char === ',' && !quoted) { cells.push(cell); cell = ''; }
    else cell += char;
  }
  cells.push(cell); return cells;
}

function exportCsv(items: Group[]) {
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const content = ['url,name,description,topic,rules,advertising,favorite,blacklisted',
    ...items.map(i => [i.url, i.name, i.description, i.topic, i.rules, i.advertising, String(i.favorite), String(i.blacklisted)].map(quote).join(','))].join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'fb-manager-groups.csv'; link.click();
  URL.revokeObjectURL(url);
}

function labelAdvertising(value: Group['advertising']) {
  return value === 'allowed' ? 'Cho phép' : value === 'prohibited' ? 'Không cho phép' : 'Chưa rõ';
}
