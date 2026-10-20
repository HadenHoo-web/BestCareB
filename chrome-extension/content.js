/**
 * FB Manager AI — Chrome Extension Content Script
 * Hỗ trợ 2 chế độ:
 * 1. Lưu Group/Fanpage vào FB Manager AI (Save Group).
 * 2. Robot Tự Động Đăng Bài (Auto-Fill & Auto-Post Robot):
 *    - Tự tìm ô "Bạn đang nghĩ gì?" / "Tạo bài viết"
 *    - Tự mở khung soạn thảo
 *    - Tự điền nội dung (mô phỏng gõ phím tự nhiên)
 *    - Tự bấm nút "Đăng" (Post)
 */

'use strict';

// ─── 1. BỘ GIAO TIẾP VỚI POPUP (LƯU NHÓM / FANPAGE) ──────────────────────────
const INITIAL_HASH = window.location.hash;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_GROUP_INFO') {
    const url = window.location.href;
    const match = url.match(/facebook\.com\/(groups\/[^/?#]+|[^/?#]+)/);
    if (!match) {
      sendResponse({ error: 'Không phải trang Facebook hợp lệ.' });
      return;
    }

    const pageTitle = document.title || '';
    const cleanTitle = pageTitle.replace(/\s*[|–-]\s*Facebook\s*$/, '').trim() || match[1];
    const normalizedUrl = `https://www.facebook.com/${match[1]}`;

    sendResponse({
      url: normalizedUrl,
      name: cleanTitle,
      groupId: match[1],
    });
  }

  if (message.type === 'START_AUTO_POST') {
    if (message.content) {
      startAutomation(message.content, message.autoSubmit ?? true);
    }
  }
});

// Danh sách các file ảnh đang được chọn để đăng kèm
let attachedFiles = [];

// Helper render danh sách ảnh thumbnail trong Floating Panel
function renderThumbnails() {
  const container = document.getElementById('fb-robot-thumbnails');
  const prompt = document.getElementById('fb-robot-drop-prompt');
  const countBadge = document.getElementById('fb-robot-media-count');
  if (!container || !prompt || !countBadge) return;

  countBadge.textContent = `${attachedFiles.length} ảnh`;

  if (attachedFiles.length === 0) {
    prompt.style.display = 'block';
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  prompt.style.display = 'none';
  container.style.display = 'flex';
  container.innerHTML = '';

  attachedFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'fb-robot-thumb-item';

    const img = document.createElement('img');
    img.className = 'fb-robot-thumb-img';
    img.src = URL.createObjectURL(file);
    img.title = file.name;

    const delBtn = document.createElement('button');
    delBtn.className = 'fb-robot-thumb-del';
    delBtn.innerHTML = '✕';
    delBtn.title = 'Xóa ảnh này';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      attachedFiles.splice(index, 1);
      renderThumbnails();
    });

    item.appendChild(img);
    item.appendChild(delBtn);
    container.appendChild(item);
  });

  // Nút thêm ảnh khác
  const addMore = document.createElement('div');
  addMore.className = 'fb-robot-add-more-btn';
  addMore.innerHTML = '＋';
  addMore.title = 'Thêm ảnh khác';
  addMore.addEventListener('click', (e) => {
    e.stopPropagation();
    const picker = document.getElementById('fb-robot-file-picker');
    if (picker) picker.click();
  });
  container.appendChild(addMore);
}

// ─── 2. HỖ TRỢ ĐỌC URL HASH TỪ DESKTOP APP ───────────────────────────────────
// Khi Desktop App mở link dạng: https://www.facebook.com/page#fb_post=...&fb_img=...&fb_auto=1
function checkUrlHashPayload() {
  const hash = window.location.hash || INITIAL_HASH;
  if (!hash || !hash.includes('fb_post=')) return;

  try {
    const rawQuery = hash.startsWith('#') ? hash.slice(1) : hash;
    const params = new URLSearchParams(rawQuery);
    const content = params.get('fb_post');
    const imgParam = params.get('fb_img');
    const auto = params.get('fb_auto') === '1';

    if (content) {
      // Xóa hash trên thanh địa chỉ để sạch đẹp
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch {
        // bỏ qua nếu bị sandbox
      }
      
// Helper chuyển Data URL thành File đối tượng (tránh bị Facebook CSP chặn fetch)
function dataUrlToFile(dataUrl, filename = 'post_image.jpg') {
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (err) {
    console.warn('dataUrlToFile error:', err);
    return null;
  }
}

      // Tải ảnh từ URL / Data URL đính kèm nếu có (từ Desktop App)
      if (imgParam) {
        const rawUrls = imgParam.includes('|SEP|') ? imgParam.split('|SEP|') : [imgParam];
        for (let i = 0; i < rawUrls.length; i++) {
          let url = rawUrls[i].trim();
          try {
            if (url.includes('%')) url = decodeURIComponent(url);
          } catch {
            // keep url as is
          }
          if (!url) continue;

          if (url.startsWith('data:')) {
            const ext = url.includes('image/png') ? 'png' : url.includes('image/webp') ? 'webp' : 'jpg';
            const file = dataUrlToFile(url, `photo_${Date.now()}_${i}.${ext}`);
            if (file) {
              attachedFiles.push(file);
              renderThumbnails();
            }
          } else {
            fetch(url)
              .then(res => res.blob())
              .then(blob => {
                const ext = (blob.type || 'image/jpeg').split('/')[1] || 'jpg';
                const file = new File([blob], `photo_${Date.now()}_${i}.${ext}`, { type: blob.type || 'image/jpeg' });
                attachedFiles.push(file);
                renderThumbnails();
              })
              .catch(err => console.warn('FB Manager AI: Không thể nạp ảnh từ web:', err));
          }
        }
      }

      // Khởi tạo nội dung vào Panel
      setTimeout(() => {
        const textarea = document.getElementById('fb-robot-content-input');
        if (textarea) textarea.value = content;
        
        // Tự động chạy sau 3 giây chờ Facebook tải xong DOM
        if (auto) {
          updateStatus('Đang chuẩn bị...', 'Đã nhận nội dung từ FB Manager AI. Tự động đăng sau 3 giây.');
          let count = 3;
          const interval = setInterval(() => {
            count--;
            if (count > 0) {
              updateStatus(`Đếm ngược ${count}s...`, 'Tự động mở ô đăng bài và điền nội dung.');
            } else {
              clearInterval(interval);
              startAutomation(content, true);
            }
          }, 1000);
        }
      }, 1200);
    }
  } catch (err) {
    console.error('FB Manager AI: Lỗi đọc URL hash:', err);
  }
}

// ─── 3. TẠO WIDGET FLOATING TRÊN GIAO DIỆN FACEBOOK ──────────────────────────
function injectFloatingPanel() {
  if (document.getElementById('fb-manager-robot-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'fb-manager-robot-panel';
  panel.innerHTML = `
    <div class="fb-robot-header">
      <div class="fb-robot-title">
        <span>🤖</span>
        <span>FB Manager AI</span>
        <span class="fb-robot-badge">V2 Auto</span>
      </div>
      <div class="fb-robot-controls">
        <button class="fb-robot-icon-btn" id="fb-robot-toggle" title="Thu nhỏ/Mở rộng">─</button>
      </div>
    </div>
    <div class="fb-robot-body">
      <div class="fb-robot-step-card">
        <div class="fb-robot-status" id="fb-robot-status-title">
          <span>●</span> <span>Sẵn sàng</span>
        </div>
        <div class="fb-robot-substatus" id="fb-robot-status-desc">
          Nhập hoặc nhận bài viết từ app để tự động đăng.
        </div>
      </div>
      <textarea
        class="fb-robot-textarea"
        id="fb-robot-content-input"
        placeholder="Nội dung bài viết cần đăng..."
      ></textarea>

      <!-- Khu vực chọn ảnh đính kèm -->
      <div class="fb-robot-media-section">
        <div class="fb-robot-media-header">
          <span class="fb-robot-media-title">📷 Hình ảnh đính kèm:</span>
          <span class="fb-robot-media-count" id="fb-robot-media-count">0 ảnh</span>
        </div>
        <div class="fb-robot-dropzone" id="fb-robot-dropzone">
          <input type="file" id="fb-robot-file-picker" accept="image/*" multiple style="display: none;" />
          <div class="fb-robot-drop-prompt" id="fb-robot-drop-prompt">
            <span>➕ Bấm để chọn ảnh từ máy (hoặc kéo thả vào đây)</span>
          </div>
          <div class="fb-robot-thumbnails" id="fb-robot-thumbnails" style="display: none;"></div>
        </div>
      </div>

      <div class="fb-robot-options">
        <label class="fb-robot-check">
          <input type="checkbox" id="fb-robot-auto-submit" checked />
          <span>Tự động bấm nút "Đăng" sau khi gõ</span>
        </label>
      </div>
      <button class="fb-robot-btn" id="fb-robot-start-btn">
        <span>▶</span> <span>Bắt đầu tự động đăng bài</span>
      </button>
    </div>
    <div class="fb-robot-footer">
      <span>Trợ lý đăng bài tự động</span>
      <span>v0.2.0</span>
    </div>
  `;

  document.body.appendChild(panel);

  // Sự kiện chọn ảnh từ máy qua file picker
  const picker = document.getElementById('fb-robot-file-picker');
  const dropzone = document.getElementById('fb-robot-dropzone');

  if (dropzone && picker) {
    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('.fb-robot-thumb-del') || e.target.closest('.fb-robot-add-more-btn')) return;
      picker.click();
    });

    picker.addEventListener('change', () => {
      if (picker.files) {
        for (const f of picker.files) {
          if (f.type.startsWith('image/')) attachedFiles.push(f);
        }
        renderThumbnails();
      }
    });

    // Hỗ trợ kéo thả ảnh vào khu vực dropzone
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer?.files) {
        for (const f of e.dataTransfer.files) {
          if (f.type.startsWith('image/')) attachedFiles.push(f);
        }
        renderThumbnails();
      }
    });
  }

  // Sự kiện nút Thu nhỏ
  const toggleBtn = document.getElementById('fb-robot-toggle');
  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('minimized');
    toggleBtn.textContent = panel.classList.contains('minimized') ? '▲' : '─';
  });

  // Sự kiện nút Bắt đầu
  const startBtn = document.getElementById('fb-robot-start-btn');
  startBtn.addEventListener('click', () => {
    if (isAutomating) {
      stopAutomation();
    } else {
      const textarea = document.getElementById('fb-robot-content-input');
      const autoSubmit = document.getElementById('fb-robot-auto-submit').checked;
      const text = textarea?.value?.trim();
      if (!text) {
        alert('Vui lòng nhập nội dung bài viết trước khi chạy!');
        return;
      }
      startAutomation(text, autoSubmit);
    }
  });
}

function updateStatus(title, desc, color = '#167368') {
  const titleEl = document.getElementById('fb-robot-status-title');
  const descEl = document.getElementById('fb-robot-status-desc');
  if (titleEl) {
    titleEl.innerHTML = `<span>●</span> <span>${escapeHtml(title)}</span>`;
    titleEl.style.color = color;
  }
  if (descEl) {
    descEl.textContent = desc;
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── 4. ĐỘNG CƠ TỰ ĐỘNG HÓA FACEBOOK (AUTOMATION ENGINE) ──────────────────────
let isAutomating = false;
let shouldStop = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isElementVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
}

// Helper: Click mô phỏng người dùng thật cho React 18
function triggerClick(el) {
  if (!el) return;
  try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* ignore */ }
  try { el.focus(); } catch { /* ignore */ }

  const rect = el.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;

  const eventOpts = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    pointerId: 1,
    isPrimary: true,
  };

  try { el.dispatchEvent(new PointerEvent('pointerdown', eventOpts)); } catch { /* ignore */ }
  el.dispatchEvent(new MouseEvent('mousedown', eventOpts));
  try { el.dispatchEvent(new PointerEvent('pointerup', eventOpts)); } catch { /* ignore */ }
  el.dispatchEvent(new MouseEvent('mouseup', eventOpts));
  el.click();
}

// Kiểm tra xem một phần tử có phải là ô comment / bình luận không
function isCommentBox(el) {
  if (!el) return false;
  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
  if (aria.includes('bình luận') || aria.includes('comment') || aria.includes('trả lời') || aria.includes('reply')) {
    return true;
  }
  if (el.closest('form[action*="comment"], div[aria-label*="bình luận" i], div[aria-label*="comment" i], ul[aria-label*="bình luận" i], div[data-visualcompletion="ignore-dynamic-and-static"]')) {
    return true;
  }
  return false;
}

// Tìm ô kích hoạt "Bạn đang nghĩ gì?" / "Tạo bài viết" trên Fanpage hoặc Group
function findCreatePostTrigger() {
  const labels = [
    'bạn đang nghĩ gì', 'bạn viết gì đi', 'tạo bài viết', 'viết bài', 'tạo bài',
    'viết gì đó', 'tạo bài viết công khai', "what's on your mind", 'create a post', 'write something'
  ];

  // 1. Thử theo aria-label chính xác (loại trừ comment)
  for (const label of labels) {
    const elements = document.querySelectorAll(`div[role="button"][aria-label*="${label}" i], span[aria-label*="${label}" i]`);
    for (const el of elements) {
      if (isElementVisible(el) && !isCommentBox(el)) return el;
    }
  }

  // 2. Thử tìm thẻ có text "Bạn đang nghĩ gì?" (như trên ảnh inspect: div[role="button"] chứa text Bạn đang nghĩ gì?)
  const buttons = document.querySelectorAll('div[role="button"], span');
  for (const el of buttons) {
    if (!isElementVisible(el)) continue;
    if (isCommentBox(el)) continue;
    // Bỏ qua nếu là avatar ảnh đại diện
    if (el.tagName === 'IMG' || el.querySelector('img[src*="profile"]')) continue;

    const text = (el.innerText || el.textContent || '').trim().toLowerCase();
    for (const label of labels) {
      if (text === label || (text.startsWith(label) && text.length <= label.length + 12)) {
        return el.closest('div[role="button"]') || el;
      }
    }
  }

  return null;
}

// Tìm ô nhập nội dung bên trong modal (CHỈ tìm trong modal tạo bài viết, TUYỆT ĐỐI không lấy ô comment)
function findEditorTextbox() {
  // Khung soạn thảo bài viết CHỈ nằm trong dialog modal "Tạo bài viết"
  const dialogs = document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]');
  for (const dialog of dialogs) {
    // 1. Lexical Editor hoặc Contenteditable textbox của Facebook bên trong dialog
    const editors = dialog.querySelectorAll('div[contenteditable="true"][role="textbox"], div[data-lexical-editor="true"], div[contenteditable="true"]');
    for (const editor of editors) {
      if (isElementVisible(editor) && !isCommentBox(editor)) {
        return editor;
      }
    }

    // 2. Tìm qua paragraph p.xdj266r bên trong dialog
    const p = dialog.querySelector('p.xdj266r, p[data-lexical-text="true"]');
    if (p && isElementVisible(p)) {
      const parent = p.closest('div[contenteditable="true"]') || p.parentElement;
      if (parent && !isCommentBox(parent)) {
        return parent;
      }
    }
  }

  // Tuyệt đối không fallback ra document vì sẽ bị dính ô comment trên trang!
  return null;
}

// Tìm nút theo danh sách từ khóa chính xác (loại bỏ các nút gây nhầm lẫn như "Video trực tiếp")
function findButtonByText(labels, root = document) {
  const normLabels = labels.map(l => l.toLowerCase().trim());

  // Lấy các dialog modal đang mở (nếu có), ưu tiên tìm trong dialog trước
  const dialogs = Array.from(root.querySelectorAll?.('div[role="dialog"], div[aria-modal="true"]') || []).filter(isElementVisible);
  const searchContainers = dialogs.length > 0 ? [...dialogs, root] : [root];

  // Helper kiểm tra xem nhãn có khớp từ khóa hợp lệ không
  function isLabelMatch(str) {
    if (!str) return false;
    const s = str.trim().toLowerCase();

    // Loại trừ nghiêm ngặt các nút gây hiểu lầm trên Facebook:
    // "Video trực tiếp" không phải là nút "Tiếp"
    if (normLabels.includes('tiếp') || normLabels.includes('next')) {
      if (s.includes('trực tiếp') || s.includes('live') || s.includes('liên kết')) return false;
    }
    // "Đăng xuất" không phải là nút "Đăng"
    if (normLabels.includes('đăng') || normLabels.includes('post')) {
      if (s.includes('đăng xuất') || s.includes('logout') || s.includes('đăng ký')) return false;
    }

    // 1. So khớp chính xác 100%
    for (const label of normLabels) {
      if (s === label) return true;
    }

    // 2. So khớp prefix ngắn (ví dụ "Tiếp theo", "Đăng ngay")
    for (const label of normLabels) {
      if (s.startsWith(label) && s.length <= label.length + 8) return true;
    }

    return false;
  }

  for (const container of searchContainers) {
    // 1. Quét thẻ role="button" hoặc <button>
    const candidates = container.querySelectorAll('div[role="button"], button');
    for (const el of candidates) {
      if (!isElementVisible(el)) continue;

      const aria = el.getAttribute('aria-label') || '';
      if (isLabelMatch(aria)) return el;

      const inner = el.innerText || el.textContent || '';
      if (isLabelMatch(inner)) return el;
    }

    // 2. Quét thẻ div, span lá chứa text (như span chữ "Tiếp")
    const textEls = container.querySelectorAll('span, div');
    for (const el of textEls) {
      if (!isElementVisible(el)) continue;
      if (el.children.length <= 1) {
        const txt = el.innerText || el.textContent || '';
        if (isLabelMatch(txt)) {
          const btnParent = el.closest('div[role="button"]') || el.closest('button');
          if (btnParent && isElementVisible(btnParent)) {
            const parentAria = btnParent.getAttribute('aria-label') || '';
            if (parentAria && !isLabelMatch(parentAria) && (parentAria.includes('trực tiếp') || parentAria.includes('đăng xuất'))) {
              continue;
            }
            return btnParent;
          }
        }
      }
    }
  }

  return null;
}

// Xóa sạch nội dung cũ trong khung soạn thảo Lexical Facebook
async function clearEditor(editor) {
  triggerClick(editor);
  try { editor.focus(); } catch { /* ignore */ }
  await sleep(100);

  // 1. Dùng window.getSelection() + Range để bôi đen toàn bộ nội dung trong editor
  try {
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } catch { /* ignore */ }

  document.execCommand('delete', false, null);
  await sleep(60);

  // 2. Dùng selectAll và delete
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  await sleep(60);

  // 3. Nếu vẫn còn sót text, làm sạch node con
  if ((editor.textContent || '').trim().length > 0) {
    editor.innerHTML = '<p class="xdj266r x14z9mp xat24cr x1lziwak x16tdsg8" dir="auto"><br></p>';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Giả lập gõ chữ tự nhiên vào Lexical Editor (đã sửa dứt điểm lỗi double text)
async function insertTextIntoEditor(editor, text) {
  const cleanTarget = text.trim();
  const currentText = (editor.textContent || editor.innerText || '').trim();

  // 1. Nếu nội dung hiện tại đã khớp chính xác với nội dung cần đăng -> không chèn lại nữa
  if (currentText === cleanTarget) {
    console.log('FB Manager AI: Ô soạn thảo đã có sẵn nội dung chính xác, bỏ qua bước gõ lại.');
    return;
  }

  // 2. Nếu đã có chữ cũ hoặc bị lặp lại nhiều lần -> xóa sạch trước khi gõ
  if (currentText.length > 0) {
    await clearEditor(editor);
    await sleep(150);
  }

  triggerClick(editor);
  try { editor.focus(); } catch { /* ignore */ }
  await sleep(120);

  // 3. Gõ bằng execCommand duy nhất một lần
  // KHÔNG gọi manual dispatchEvent(beforeinput) hay (input) vì Chrome đã tự động kích hoạt
  // việc gọi thủ công trước đây khiến Facebook Lexical nhận 2 lần sự kiện dẫn đến duplicate!
  const success = document.execCommand('insertText', false, text);
  if (!success) {
    // Dự phòng nếu trình duyệt chặn execCommand
    const p = editor.querySelector('p');
    if (p) {
      p.innerHTML = `<span data-lexical-text="true">${escapeHtml(text)}</span>`;
    } else {
      editor.innerText = text;
    }
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  await sleep(150);

  // 4. Cơ chế chống double text (nếu sau khi gõ bị lặp 2 lần liên tiếp do Lexical bắt trùng)
  const afterText = (editor.textContent || editor.innerText || '').trim();
  if (afterText.length >= cleanTarget.length * 2 && afterText.startsWith(cleanTarget)) {
    const remainder = afterText.slice(cleanTarget.length).trim();
    if (remainder === cleanTarget) {
      console.warn('FB Manager AI: Phát hiện bị duplicate 2 lần, đang dọn sạch 1 bản...');
      await clearEditor(editor);
      await sleep(100);
      editor.innerText = cleanTarget;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

// Tìm thẻ input file đính kèm ảnh của Facebook trong modal
function findFacebookPhotoInput() {
  const dialogs = document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]');
  for (const dialog of dialogs) {
    const input = dialog.querySelector('input[type="file"][accept*="image"]');
    if (input) return input;
  }
  return document.querySelector('input[type="file"][accept*="image"]');
}

// Tự động đính kèm hình ảnh vào bài viết Facebook
async function attachImagesToFacebook(files) {
  if (!files || files.length === 0) return true;

  // 1. Tìm thẻ input file upload ảnh của Facebook
  let fileInput = findFacebookPhotoInput();

  // 2. Nếu chưa có input file trong DOM, bấm nút "Ảnh/video" để Facebook kích hoạt
  if (!fileInput) {
    const photoBtn = findButtonByText(['ảnh/video', 'thêm ảnh/video', 'photo/video', 'add photo']);
    if (photoBtn) {
      triggerClick(photoBtn);
      await sleep(1200);
      fileInput = findFacebookPhotoInput();
    }
  }

  // Dự phòng nút "Tải ảnh/video khác lên"
  if (!fileInput) {
    const uploadBtn = findButtonByText(['tải ảnh/video', 'thêm ảnh', 'upload photo']);
    if (uploadBtn) {
      triggerClick(uploadBtn);
      await sleep(1200);
      fileInput = findFacebookPhotoInput();
    }
  }

  if (!fileInput) {
    console.error('FB Manager AI: Không tìm thấy input file upload của Facebook.');
    return false;
  }

  // 3. Gán danh sách file vào fileInput qua DataTransfer
  try {
    const dt = new DataTransfer();
    for (const f of files) {
      dt.items.add(f);
    }

    try {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
      if (descriptor && descriptor.set) {
        descriptor.set.call(fileInput, dt.files);
      } else {
        fileInput.files = dt.files;
      }
    } catch {
      fileInput.files = dt.files;
    }

    // Kích hoạt change & input events cho React SyntheticEvent
    fileInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

    return true;
  } catch (err) {
    console.error('FB Manager AI: Lỗi đính kèm file ảnh:', err);
    return false;
  }
}

async function startAutomation(content, autoSubmit) {
  if (isAutomating) return;
  isAutomating = true;
  shouldStop = false;

  const startBtn = document.getElementById('fb-robot-start-btn');
  if (startBtn) {
    startBtn.innerHTML = '<span>⏹</span> <span>Dừng tự động</span>';
    startBtn.classList.add('stop');
  }

  try {
    // ── KIỂM TRA XEM KHUNG SOẠN THẢO ĐÃ MỞ SẴN CHƯA ──
    let editor = findEditorTextbox();

    if (!editor) {
      // ── BƯỚC 1: Tìm ô "Bạn đang nghĩ gì?" ──
      updateStatus('Bước 1/4: Đang tìm ô viết bài...', 'Đang quét ô "Bạn đang nghĩ gì?" hoặc "Tạo bài viết".');
      await sleep(600);
      if (shouldStop) return;

      let trigger = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        if (shouldStop) return;
        trigger = findCreatePostTrigger();
        if (trigger) break;
        window.scrollBy({ top: 120, behavior: 'smooth' });
        await sleep(1000);
      }

      if (!trigger) {
        updateStatus('Không tìm thấy ô viết bài', 'Hãy mở sẵn ô tạo bài viết hoặc kiểm tra xem bạn có quyền đăng bài / đã chuyển sang Trang chưa.', '#c15544');
        stopAutomation();
        return;
      }

      // ── BƯỚC 2: Mở khung soạn thảo ──
      updateStatus('Bước 2/4: Mở khung soạn thảo...', 'Đang mở cửa sổ tạo bài viết.');
      triggerClick(trigger);
      await sleep(1500);
      if (shouldStop) return;

      // Chờ khung soạn thảo xuất hiện
      for (let attempt = 0; attempt < 10; attempt++) {
        if (shouldStop) return;
        editor = findEditorTextbox();
        if (editor) break;
        // Nếu sau 2s chưa thấy, thử click lại trigger 1 lần nữa
        if (attempt === 2) triggerClick(trigger);
        await sleep(600);
      }
    } else {
      updateStatus('Bước 2/4: Đã mở sẵn...', 'Khung soạn thảo đã mở, bắt đầu điền nội dung.');
    }

    if (!editor) {
      updateStatus('Lỗi mở ô soạn thảo', 'Không tìm thấy khung nhập bài viết. Bạn hãy click vào ô "Bạn đang nghĩ gì?" và bấm Bắt đầu lại nhé.', '#c15544');
      stopAutomation();
      return;
    }

    // ── BƯỚC 3: Điền nội dung bài viết ──
    updateStatus('Bước 3/4: Điền nội dung...', 'Đang gõ bài viết vào khung soạn thảo Facebook.');
    await insertTextIntoEditor(editor, content);
    await sleep(1200);
    if (shouldStop) return;

    // ── BƯỚC 3.5: Đính kèm hình ảnh (nếu có) ──
    if (attachedFiles.length > 0) {
      updateStatus('Bước 3.5/4: Thêm hình ảnh...', `Đang tải ${attachedFiles.length} hình ảnh vào bài viết.`);
      const uploadSuccess = await attachImagesToFacebook(attachedFiles);
      if (!uploadSuccess) {
        updateStatus('Cảnh báo tải ảnh', 'Không tìm thấy nút đính kèm ảnh của Facebook. Robot sẽ tiếp tục đăng text.', '#c39b4e');
      }
      // Chờ Facebook xử lý upload và hiển thị thumbnail ảnh
      await sleep(3000);
      if (shouldStop) return;
    }

    // ── BƯỚC 4: Bấm nút Xuất bản (Xử lý cả Fanpage "Tiếp" -> "Đăng" và Group "Đăng") ──
    if (!autoSubmit) {
      updateStatus('✅ Đã điền xong nội dung!', 'Đã gõ bài viết thành công. Hãy bấm "Tiếp" hoặc "Đăng" trên Facebook khi bạn sẵn sàng.', '#28896c');
      stopAutomation();
      return;
    }

    updateStatus('Bước 4/4: Kích hoạt nút xuất bản...', 'Đang tìm nút Tiếp / Đăng.');

    // 1. Kiểm tra xem có nút "Tiếp" (đặc trưng của Fanpage) không
    let nextBtn = findButtonByText(['tiếp', 'next']);
    if (nextBtn) {
      // Đợi nút Tiếp sẵn sàng nếu đang trong trạng thái disabled
      for (let attempt = 0; attempt < 10; attempt++) {
        if (shouldStop) return;
        if (nextBtn.getAttribute('aria-disabled') !== 'true') break;
        await sleep(300);
        nextBtn = findButtonByText(['tiếp', 'next']) || nextBtn;
      }

      if (nextBtn && nextBtn.getAttribute('aria-disabled') !== 'true') {
        updateStatus('Đang bấm nút "Tiếp"...', 'Chuyển sang bước xác nhận đăng bài.');
        triggerClick(nextBtn);
        await sleep(1500);
        if (shouldStop) return;
      }
    }

    // 2. Tìm nút "Đăng" / "Chia sẻ" cuối cùng (cho cả Fanpage bước 2 và Group/Profile)
    updateStatus('Đang bấm nút "Đăng"...', 'Đang xác nhận gửi bài viết lên Facebook.');
    let postBtn = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      if (shouldStop) return;
      postBtn = findButtonByText(['đăng', 'chia sẻ', 'post', 'publish', 'chia sẻ ngay', 'xong']);
      if (postBtn && postBtn.getAttribute('aria-disabled') !== 'true') {
        break;
      }
      await sleep(500);
    }

    if (!postBtn) {
      updateStatus('Đã điền bài viết xong!', 'Nội dung đã được điền đầy đủ. Vui lòng bấm nút Đăng/Tiếp bằng tay nhé.', '#c39b4e');
      stopAutomation();
      return;
    }

    const ariaDisabled = postBtn.getAttribute('aria-disabled');
    if (ariaDisabled === 'true') {
      updateStatus('Nút Đăng chưa sẵn sàng', 'Facebook chưa kích hoạt nút Đăng. Bạn hãy bấm bằng tay nhé.', '#c39b4e');
      stopAutomation();
      return;
    }

    triggerClick(postBtn);
    await sleep(2500);

    const imgCount = attachedFiles.length;
    const successMsg = imgCount > 0
      ? `Bài viết cùng ${imgCount} ảnh đã được gửi lên Facebook! Hãy quay lại FB Manager AI để xác nhận hoàn tất!`
      : 'Bài viết đã được gửi lên Facebook. Hãy quay lại FB Manager AI để xác nhận hoàn tất!';

    updateStatus('🎉 Đã bấm Đăng thành công!', successMsg, '#28896c');
  } catch (err) {
    console.error('FB Manager AI Automation Error:', err);
    updateStatus('Lỗi tự động hóa', err.message || 'Không thể hoàn tất bước đăng.', '#c15544');
  } finally {
    stopAutomation();
  }
}

function stopAutomation() {
  isAutomating = false;
  shouldStop = true;
  const startBtn = document.getElementById('fb-robot-start-btn');
  if (startBtn) {
    startBtn.innerHTML = '<span>▶</span> <span>Bắt đầu tự động đăng bài</span>';
    startBtn.classList.remove('stop');
  }
}

// ─── KHỞI CHẠY KHI TẢI TRANG ──────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectFloatingPanel();
    checkUrlHashPayload();
  });
} else {
  injectFloatingPanel();
  checkUrlHashPayload();
}
