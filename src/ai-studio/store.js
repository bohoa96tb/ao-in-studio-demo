// AI Studio — IndexedDB storage, database `ao-in-ai-studio` (own DB; the shop's
// and print workspace's databases are never touched).
//
// Schema history:
//  v1 (P1): stores `projects`, `assets`.
//  v2 (P2): adds `runs` (run history), `versions` (project version snapshots),
//           `cache` (node output cache, keyPath = cache key),
//           `drafts` (unsaved-draft records for crash recovery, keyPath = projectId).
// The upgrade only ADDS stores — every P1 project/asset record stays readable.
const DB = 'ao-in-ai-studio';
export const DB_VERSION = 2;
const STORES = ['projects', 'assets', 'runs', 'versions', 'cache', 'drafts'];
function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('versions')) db.createObjectStore('versions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'projectId' });
    };
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}
async function tx(storeName, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode); const s = t.objectStore(storeName); const req = fn(s);
    t.oncomplete = () => { db.close(); resolve(req?.result); }; t.onerror = () => { db.close(); reject(t.error); };
  });
}
const put = (storeName) => (rec) => tx(storeName, 'readwrite', s => s.put(rec));
const get = (storeName) => (id) => tx(storeName, 'readonly', s => s.get(id));
const getAll = (storeName) => () => tx(storeName, 'readonly', s => s.getAll());
const del = (storeName) => (id) => tx(storeName, 'readwrite', s => s.delete(id));
const clear = (storeName) => () => tx(storeName, 'readwrite', s => s.clear());

export const store = {
  // P1 API (unchanged semantics)
  saveProject: put('projects'), getProject: get('projects'), listProjects: getAll('projects'), deleteProject: del('projects'),
  saveAsset: put('assets'), getAsset: get('assets'), deleteAsset: del('assets'), listAssets: getAll('assets'),
  // P2: run history
  saveRun: put('runs'),
  listRuns: async (projectId) => (await getAll('runs')()).filter(r => !projectId || r.projectId === projectId),
  deleteRun: del('runs'),
  clearRuns: async (projectId) => { for (const r of await store.listRuns(projectId)) await del('runs')(r.id); },
  // P2: project versions
  saveVersion: put('versions'),
  listVersions: async (projectId) => (await getAll('versions')()).filter(v => !projectId || v.projectId === projectId),
  deleteVersion: del('versions'),
  // P2: node output cache
  putCache: put('cache'), getCache: get('cache'), deleteCache: del('cache'), listCache: getAll('cache'), clearCache: clear('cache'),
  // P2: unsaved drafts (crash recovery)
  saveDraft: put('drafts'), getDraft: get('drafts'), listDrafts: getAll('drafts'), deleteDraft: del('drafts'),
  /** Remove everything belonging to one project except its assets (assets are
   * shared/orphan-collected separately by the GC). */
  async deleteProjectCascade(projectId) {
    await del('projects')(projectId);
    await del('drafts')(projectId);
    for (const r of await store.listRuns(projectId)) await del('runs')(r.id);
    for (const v of await store.listVersions(projectId)) await del('versions')(v.id);
    for (const c of (await getAll('cache')()).filter(c => c.projectId === projectId)) await del('cache')(c.key);
  },
};
export async function storageEstimate() {
  if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); return { usage: e.usage || 0, quota: e.quota || 0 }; }
  return { usage: 0, quota: 0 };
}
export { STORES as STORE_NAMES };
