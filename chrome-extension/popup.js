/**
 * FB Manager AI — Extension Popup Script
 * 
 * Lấy thông tin Group từ content script và lưu vào storage để
 * người dùng có thể copy URL + tên vào desktop app thủ công.
 * 
 * Lưu ý: Chrome Extension không thể giao tiếp trực tiếp với Tauri app
 * qua IPC vì security sandbox. Giải pháp an toàn nhất là:
 * 1. Lưu vào chrome.storage.local (người dùng copy thủ công)
 * 2. Native messaging (cần native host đăng ký với OS — phức tạp hơn)
 * 
 * Phiên bản này dùng giải pháp (1): lưu vào clipboard để dán vào app.
 */

'use strict';

const content = document.getElementById('content');

function setStatus(message, type = 'info') {
  const existing = content.querySelector('.status');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = `status ${type}`;
  div.textContent = message;
  content.appendChild(div);
}

async function init() {
  // Lấy tab hiện tại
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isFb = tab?.url && (tab.url.includes('facebook.com') || tab.url.includes('fb.com'));
  if (!tab?.id || !isFb) {
    content.innerHTML = '<div class="not-group">Hãy mở một trang Facebook Group hoặc Fanpage để sử dụng extension này.</div>';
    return;
  }

  let groupInfo;
  try {
    groupInfo = await chrome.tabs.sendMessage(tab.id, { type: 'GET_GROUP_INFO' });
  } catch {
    content.innerHTML = '<div class="not-group">Không thể đọc thông tin Group. Hãy tải lại trang Facebook.</div>';
    return;
  }

  if (groupInfo?.error) {
    content.innerHTML = `<div class="not-group">${groupInfo.error}</div>`;
    return;
  }

  // Hiển thị thông tin Group
  content.innerHTML = `
    <div class="group-info">
      <p class="group-name">${escapeHtml(groupInfo.name)}</p>
      <p class="group-url">${escapeHtml(groupInfo.url)}</p>
    </div>
    <button class="btn" id="copyBtn">📋 Copy để dán vào FB Manager AI</button>
    <p class="note">Extension copy URL và tên Group. Dán vào FB Manager AI → Quản lý nhóm → Thêm nhóm.</p>
  `;

  document.getElementById('copyBtn').addEventListener('click', async () => {
    const text = `URL: ${groupInfo.url}\nTên: ${groupInfo.name}`;
    try {
      await navigator.clipboard.writeText(text);
      
      // Lưu lịch sử vào storage
      const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
      const isDup = savedGroups.some(g => g.url === groupInfo.url);
      if (!isDup) {
        savedGroups.unshift({ ...groupInfo, savedAt: new Date().toISOString() });
        if (savedGroups.length > 50) savedGroups.pop();
        await chrome.storage.local.set({ savedGroups });
      }
      
      setStatus(isDup ? '✓ URL đã có trong lịch sử. Đã copy lại.' : '✓ Đã copy! Mở FB Manager AI và dán vào ô URL.', 'success');
    } catch {
      setStatus('Không thể copy. Hãy copy URL thủ công từ thanh địa chỉ.', 'error');
    }
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init().catch(err => {
  content.innerHTML = `<div class="not-group">Lỗi: ${err.message}</div>`;
});
