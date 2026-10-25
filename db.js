// Tiny promise wrapper around IndexedDB. Everything stays on this device.
const DB = (() => {
  const NAME = 'seam-log';
  const VERSION = 1;
  const STORES = ['measurements', 'profiles', 'projects', 'photos', 'meta'];
  let dbPromise;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function wrap(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function tx(store, mode, fn) {
    const db = await open();
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    await new Promise((resolve, reject) => {
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
    return result instanceof IDBRequest ? result.result : result;
  }

  return {
    all: (store) => open().then(db => wrap(db.transaction(store).objectStore(store).getAll())),
    get: (store, id) => open().then(db => wrap(db.transaction(store).objectStore(store).get(id))),
    put: (store, value) => tx(store, 'readwrite', s => s.put(value)),
    del: (store, id) => tx(store, 'readwrite', s => s.delete(id)),
    clear: (store) => tx(store, 'readwrite', s => s.clear()),
    STORES,
  };
})();
