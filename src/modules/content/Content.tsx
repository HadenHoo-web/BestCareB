/* eslint-disable react-hooks/exhaustive-deps -- query is debounced/driven by user input */
import { useEffect, useRef, useState } from 'react';
import { Check, Edit3, KeyRound, LoaderCircle, Save, Sparkles, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { AiConfig, AiDraft, AiRequest, ContentInput, ContentTemplate } from '../../types';
import {
  clearAiConfig, createContent, deleteContent, generateContent,
  getAiConfig, listContent, saveAiConfig, updateContent,
} from '../../services/database';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/Modal';

export function Content() {
  const [items, setItems] = useState<ContentTemplate[]>([]);
  const [drafts, setDrafts] = useState<AiDraft[]>([]);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<{ index: number; body: string } | null>(null);
  const [previewDraft, setPreviewDraft] = useState<AiDraft | null>(null);
  const [editTemplate, setEditTemplate] = useState<ContentTemplate | null>(null);
  const [query, setQuery] = useState('');

  const load = async () => {
    try {
      const [data, ai] = await Promise.all([listContent(query), getAiConfig()]);
      setItems(data.items); setConfig(ai);
    } catch { toast.error('Không thể tải thư viện nội dung.'); }
  };

  useEffect(() => { void load(); }, [query]);

  const generate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await generateContent({
        topic: String(data.get('topic')),
        product: String(data.get('product')),
        audience: String(data.get('audience')),
        tone: String(data.get('tone')) as AiRequest['tone'],
        length: String(data.get('length')) as AiRequest['length'],
        variants: Number(data.get('variants')),
      });
      setDrafts(result);
      toast.success(config?.configured ? 'Đã tạo bản nháp bằng AI' : 'Đã tạo bản nháp demo cục bộ');
    } catch (error) { toast.error(typeof error === 'string' ? error : error instanceof Error ? error.message : 'Không thể tạo nội dung.'); }
    finally { setBusy(false); }
  };

  const saveDraft = async (draft: AiDraft, index: number) => {
    const body = editDraft?.index === index ? editDraft.body : draft.body;
    try {
      await createContent({ title: draft.title, body, hashtags: draft.hashtags });
      toast.success('Đã lưu vào thư viện'); await load();
    } catch { toast.error('Không thể lưu nội dung.'); }
  };

  const updateDraftBody = (index: number, body: string) => {
    setDrafts(prev => prev.map((d, i) => i === index ? { ...d, body } : d));
    setEditDraft(null);
  };

  return (
    <>
      <div className="content-layout">
        {/* ── Composer ── */}
        <section className="card composer">
          <div className="card-heading">
            <div>
              <h2><Sparkles size={18} /> Sáng tạo nội dung</h2>
              <p className="muted">{config?.configured ? 'OpenAI đã được cấu hình an toàn.' : 'Chế độ demo đang hoạt động; không cần API key.'}</p>
            </div>
            <Button variant="outline" onClick={() => setConfigOpen(true)}><KeyRound size={15} />Cấu hình AI</Button>
          </div>

          <form className="form composer-form" onSubmit={generate}>
            <label>Chủ đề<input name="topic" required maxLength={300} placeholder="Ví dụ: chăm sóc da cho người bận rộn" /></label>
            <label>Sản phẩm hoặc dịch vụ<input name="product" required maxLength={500} placeholder="Ví dụ: tư vấn da liễu trực tuyến" /></label>
            <label>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={13} /> Đối tượng khách hàng
              </span>
              <input name="audience" maxLength={300} placeholder="Ví dụ: phụ nữ 25–40 tuổi quan tâm đến sức khỏe" />
            </label>
            <div className="form-grid">
              <label>Giọng văn
                <select name="tone" defaultValue="friendly">
                  <option value="professional">Chuyên nghiệp</option>
                  <option value="friendly">Thân thiện</option>
                  <option value="sales">Bán hàng</option>
                  <option value="experience">Chia sẻ kinh nghiệm</option>
                </select>
              </label>
              <label>Độ dài
                <select name="length" defaultValue="medium">
                  <option value="short">Ngắn</option>
                  <option value="medium">Vừa</option>
                  <option value="long">Dài</option>
                </select>
              </label>
            </div>
            <label>Số bản nháp
              <select name="variants" defaultValue="1">
                <option value="1">1 bản</option>
                <option value="2">2 bản</option>
                <option value="3">3 bản</option>
              </select>
            </label>
            <div className="form-actions">
              <Button disabled={busy}>
                {busy ? <><LoaderCircle className="spin" size={16} />Đang tạo…</> : <><Sparkles size={16} />Tạo nội dung</>}
              </Button>
            </div>
          </form>
        </section>

        {/* ── Drafts ── */}
        <section className="card drafts">
          <div className="card-heading">
            <h2>Bản nháp mới</h2>
            {drafts.length > 0 && <span className="subtle-pill">{drafts.length} bản</span>}
          </div>
          {drafts.length === 0 ? (
            <div className="empty-mini">
              <span className="empty-icon"><Sparkles size={24} /></span>
              <h3>Chờ ý tưởng của bạn</h3>
              <p>Nhập chủ đề để tạo nội dung tiếng Việt có thể chỉnh sửa trước khi dùng.</p>
            </div>
          ) : drafts.map((draft, index) => (
            <article className="draft" key={`${draft.title}-${index}`}>
              <strong>{draft.title}</strong>
              {editDraft?.index === index ? (
                <>
                  <textarea
                    className="draft-edit-textarea"
                    value={editDraft.body}
                    onChange={e => setEditDraft({ index, body: e.target.value })}
                    rows={8}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <Button variant="outline" onClick={() => setEditDraft(null)}>Hủy</Button>
                    <Button onClick={() => updateDraftBody(index, editDraft.body)}><Check size={14} />Xong</Button>
                  </div>
                </>
              ) : (
                <p>{drafts[index].body}</p>
              )}
              <small>{draft.hashtags}</small>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Button variant="outline" onClick={() => setEditDraft({ index, body: drafts[index].body })}>
                  <Edit3 size={14} />Chỉnh sửa
                </Button>
                <Button variant="outline" onClick={() => setPreviewDraft(drafts[index])}>
                  Xem trước
                </Button>
                <Button variant="outline" onClick={() => void saveDraft(draft, index)}>
                  <Save size={15} />Lưu vào thư viện
                </Button>
              </div>
            </article>
          ))}
        </section>
      </div>

      {/* ── Library ── */}
      <section className="card library">
        <div className="card-heading">
          <h2>Thư viện bài viết</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="subtle-pill">{items.length} nội dung</span>
            <input
              style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', fontSize: 11, background: 'var(--bg)' }}
              placeholder="Tìm kiếm…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>
        {items.length === 0 ? (
          <div className="empty-mini">
            <h3>Chưa có nội dung đã lưu</h3>
            <p>Các bản nháp bạn chọn lưu sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <div className="content-list">
            {items.map(item => (
              <article key={item.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <small>{item.hashtags}</small>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <Button size="icon" variant="ghost" aria-label={`Sửa ${item.title}`} onClick={() => setEditTemplate(item)}>
                    <Edit3 size={15} />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Xóa ${item.title}`} onClick={async () => { await deleteContent([item.id]); toast.success('Đã xóa nội dung'); await load(); }}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {configOpen && <Config config={config} onClose={() => setConfigOpen(false)} onSaved={async () => { setConfigOpen(false); await load(); }} />}
      {previewDraft && <PreviewModal draft={previewDraft} onClose={() => setPreviewDraft(null)} onSave={() => { void saveDraft(previewDraft, drafts.indexOf(previewDraft)); setPreviewDraft(null); }} />}
      {editTemplate && <EditTemplateModal template={editTemplate} onClose={() => setEditTemplate(null)} onSaved={async () => { setEditTemplate(null); await load(); }} />}
    </>
  );
}

function Config({ config, onClose, onSaved }: { config: AiConfig | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget); setBusy(true);
    try {
      await saveAiConfig(String(form.get('apiKey')), String(form.get('model')));
      toast.success('Đã lưu API key vào kho bảo mật hệ điều hành'); await onSaved();
    } catch (error) { toast.error(typeof error === 'string' ? error : error instanceof Error ? error.message : 'Không lưu được cấu hình AI.'); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="Cấu hình OpenAI" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted">API key không được lưu vào SQLite, không đưa vào log và không hiển thị lại sau khi lưu.</p>
        <label>OpenAI API key<input name="apiKey" type="password" required autoComplete="off" placeholder="sk-..." /></label>
        <label>Model<input name="model" defaultValue={config?.model ?? 'gpt-4.1-mini'} required /></label>
        <div className="form-actions">
          {config?.configured && (
            <Button type="button" variant="outline" onClick={async () => { await clearAiConfig(); toast.success('Đã xóa cấu hình AI khỏi kho bảo mật'); await onSaved(); }}>Xóa khóa</Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu bảo mật'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function PreviewModal({ draft, onClose, onSave }: { draft: AiDraft; onClose: () => void; onSave: () => void }) {
  return (
    <Modal title="Xem trước bài viết" onClose={onClose}>
      <div className="post-preview">
        <div className="preview-header">
          <div className="preview-avatar">FB</div>
          <div>
            <strong>Tài khoản của bạn</strong>
            <small className="muted">Đây là bản xem trước · Chưa đăng</small>
          </div>
        </div>
        <div className="preview-body">
          <strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>{draft.title}</strong>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 12 }}>{draft.body}</p>
          {draft.hashtags && <p style={{ color: 'var(--accent)', fontSize: 11, marginTop: 8 }}>{draft.hashtags}</p>}
        </div>
      </div>
      <div className="form-actions" style={{ padding: '0 20px 20px' }}>
        <Button variant="outline" onClick={onClose}>Đóng</Button>
        <Button onClick={onSave}><Save size={14} />Lưu vào thư viện</Button>
      </div>
    </Modal>
  );
}

function EditTemplateModal({ template, onClose, onSaved }: { template: ContentTemplate; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<ContentInput>({ title: template.title, body: template.body, hashtags: template.hashtags });
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try { await updateContent(template.id, form); toast.success('Đã cập nhật nội dung'); await onSaved(); }
    catch { toast.error('Không thể cập nhật nội dung.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Chỉnh sửa nội dung" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Tiêu đề<input required maxLength={180} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
        <label>Nội dung<textarea ref={textareaRef} required maxLength={10000} rows={8} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></label>
        <label>Hashtag<input maxLength={1000} value={form.hashtags} onChange={e => setForm({ ...form, hashtags: e.target.value })} placeholder="#hashtag1 #hashtag2" /></label>
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</Button>
        </div>
      </form>
    </Modal>
  );
}
