// AI Studio — IndexedDB storage, database `ao-in-ai-studio` (own DB; the shop's
// and print workspace's databases are never touched). Stores: projects, assets.
const DB = 'ao-in-ai-studio';
function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { const db = r.result; db.createObjectStore('projects', { keyPath: 'id' }); db.createObjectStore('assets', { keyPath: 'id' }); };
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}
async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode); const s = t.objectStore(store); const req = fn(s);
    t.oncomplete = () => { db.close(); resolve(req?.result); }; t.onerror = () => { db.close(); reject(t.error); };
  });
}
export const store = {
  saveProject: (p) => tx('projects', 'readwrite', s => s.put(p)),
  getProject: (id) => tx('projects', 'readonly', s => s.get(id)),
  listProjects: () => tx('projects', 'readonly', s => s.getAll()),
  deleteProject: (id) => tx('projects', 'readwrite', s => s.delete(id)),
  saveAsset: (a) => tx('assets', 'readwrite', s => s.put(a)),
  getAsset: (id) => tx('assets', 'readonly', s => s.get(id)),
  deleteAsset: (id) => tx('assets', 'readwrite', s => s.delete(id)),
  listAssets: () => tx('assets', 'readonly', s => s.getAll()),
};
export async function storageEstimate() {
  if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); return { usage: e.usage || 0, quota: e.quota || 0 }; }
  return { usage: 0, quota: 0 };
}
