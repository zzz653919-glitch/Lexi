/* Persistence layer. Uses IndexedDB; if it is unavailable (some private
   modes, locked-down browsers) it transparently falls back to localStorage. */
VL.db = (function () {
  const DB_NAME = 'lexi-vocabulary';
  const VERSION = 2; // v2 adds the 'days' store (daily activity: XP, goal, streak)
  const STORES = { words: 'id', collections: 'id', sessions: 'id', settings: 'key', days: 'date' };
  let idb = null;
  let backend = 'indexeddb';

  function openIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB is not available'));
      let req;
      try { req = indexedDB.open(DB_NAME, VERSION); } catch (e) { return reject(e); }
      req.onupgradeneeded = () => {
        const d = req.result;
        Object.keys(STORES).forEach((name) => {
          if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath: STORES[name] });
        });
      };
      req.onsuccess = () => {
        idb = req.result;
        idb.onversionchange = () => idb.close();
        resolve();
      };
      req.onerror = () => reject(req.error || new Error('Could not open database'));
      req.onblocked = () => reject(new Error('Database is blocked by another tab'));
    });
  }

  async function open() {
    try {
      await openIndexedDB();
      backend = 'indexeddb';
    } catch (err) {
      console.warn('Falling back to localStorage:', err);
      localStorage.setItem('lexi.probe', '1'); // throws if storage is blocked entirely
      localStorage.removeItem('lexi.probe');
      backend = 'localstorage';
    }
    return backend;
  }

  /* ---- localStorage backend ---- */
  const lsKey = (store) => 'lexi.db.' + store;
  function lsRead(store) {
    try { return JSON.parse(localStorage.getItem(lsKey(store)) || '{}'); } catch (e) { return {}; }
  }
  const lsWrite = (store, map) => localStorage.setItem(lsKey(store), JSON.stringify(map));

  /* ---- public API ---- */
  function getAll(store) {
    if (backend === 'localstorage') return Promise.resolve(Object.values(lsRead(store)));
    return new Promise((resolve, reject) => {
      const req = idb.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function put(store, items) {
    if (!items.length) return Promise.resolve();
    if (backend === 'localstorage') {
      return new Promise((resolve, reject) => {
        try {
          const map = lsRead(store);
          items.forEach((it) => { map[it[STORES[store]]] = it; });
          lsWrite(store, map);
          resolve();
        } catch (e) { reject(e); }
      });
    }
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      items.forEach((it) => os.put(it));
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Write failed'));
    });
  }

  function remove(store, keys) {
    if (!keys.length) return Promise.resolve();
    if (backend === 'localstorage') {
      return new Promise((resolve, reject) => {
        try {
          const map = lsRead(store);
          keys.forEach((k) => delete map[k]);
          lsWrite(store, map);
          resolve();
        } catch (e) { reject(e); }
      });
    }
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      keys.forEach((k) => os.delete(k));
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Delete failed'));
    });
  }

  function clear(stores) {
    const list = Array.isArray(stores) ? stores : [stores];
    if (backend === 'localstorage') {
      list.forEach((s) => localStorage.removeItem(lsKey(s)));
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(list, 'readwrite');
      list.forEach((s) => tx.objectStore(s).clear());
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Clear failed'));
    });
  }

  return { open, getAll, put, remove, clear, get backend() { return backend; } };
})();
