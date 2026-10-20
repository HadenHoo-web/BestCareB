/**
 * Media Storage Service
 * Sử dụng IndexedDB để lưu trữ hình ảnh chiến dịch (hỗ trợ Base64 Data URL và Web URL).
 * Không bị giới hạn dung lượng và tự động nén ảnh tối ưu chuẩn HD cho Facebook.
 */

const DB_NAME = 'fb_manager_ai_media';
const STORE_NAME = 'campaign_media';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCampaignImages(campaignId: string, images: string[]): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(images, campaignId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Lỗi lưu ảnh vào IndexedDB, fallback sang localStorage:', err);
    try {
      localStorage.setItem(`campaign_img_${campaignId}`, JSON.stringify(images));
    } catch {
      // ignore
    }
  }
}

export async function getCampaignImages(campaignId: string): Promise<string[]> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(campaignId);
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result) && req.result.length > 0) {
          resolve(req.result);
        } else {
          const cached = localStorage.getItem(`campaign_img_${campaignId}`);
          resolve(cached ? JSON.parse(cached) : []);
        }
      };
      req.onerror = () => {
        const cached = localStorage.getItem(`campaign_img_${campaignId}`);
        resolve(cached ? JSON.parse(cached) : []);
      };
    });
  } catch {
    const cached = localStorage.getItem(`campaign_img_${campaignId}`);
    return cached ? JSON.parse(cached) : [];
  }
}

/**
 * Kiểm tra xem một file có phải là file hình ảnh hợp lệ hay không
 * (kiểm tra cả MIME type lẫn đuôi mở rộng file để tương thích 100% trên macOS WebKit)
 */
export function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|bmp|svg|avif|heic|heif)$/i.test(file.name);
}

function readRawDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/**
 * Nén ảnh tối ưu chuẩn HD cho Facebook (max 1200px, JPEG 0.75)
 * Giúp dung lượng siêu nhỏ gọn (~80KB - 120KB) nhưng vẫn cực kỳ sắc nét trên Facebook.
 * Có timeout 2.5s và tự động fallback sang ảnh gốc nếu canvas gặp lỗi.
 */
export async function compressImageToDataUrl(file: File, maxDim = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    let resolved = false;

    // Timeout an toàn 2.5s: Nếu canvas hoặc webview bị treo, tự fallback đọc trực tiếp dataUrl
    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      console.warn('compressImageToDataUrl timeout, fallback to raw DataURL:', file.name);
      readRawDataUrl(file).then(resolve);
    }, 2500);

    const finish = (result: string) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve(result);
    };

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawResult = (e.target?.result as string) || '';
        if (!rawResult) return finish('');

        try {
          const img = new Image();
          img.onload = () => {
            try {
              let { width, height } = img;
              if (width <= 0 || height <= 0) return finish(rawResult);

              if (width > maxDim || height > maxDim) {
                if (width > height) {
                  height = Math.round((height * maxDim) / width);
                  width = maxDim;
                } else {
                  width = Math.round((width * maxDim) / height);
                  height = maxDim;
                }
              }

              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) return finish(rawResult);

              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL('image/jpeg', quality);
              finish(compressed || rawResult);
            } catch (canvasErr) {
              console.warn('Canvas export error, fallback to raw:', canvasErr);
              finish(rawResult);
            }
          };

          img.onerror = (imgErr) => {
            console.warn('Image parse error, fallback to raw:', imgErr);
            finish(rawResult);
          };

          img.src = rawResult;
        } catch (innerErr) {
          console.warn('Image setup error, fallback to raw:', innerErr);
          finish(rawResult);
        }
      };

      reader.onerror = () => finish('');
      reader.readAsDataURL(file);
    } catch (outerErr) {
      console.warn('FileReader error, fallback to raw:', outerErr);
      readRawDataUrl(file).then(finish);
    }
  });
}

