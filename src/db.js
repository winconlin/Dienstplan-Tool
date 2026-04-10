import { showToast } from './ui.js';

const DB_NAME = 'MediPlanDB';
const DB_VERSION = 1;

let dbInstance = null;

export async function initDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) return resolve(dbInstance);

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('store')) {
                db.createObjectStore('store', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('history')) {
                db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error('IndexedDB Error:', event.target.error);
            reject(event.target.error);
        };
    });
}

export async function getVal(key, fallback = null) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['store'], 'readonly');
        const store = transaction.objectStore('store');
        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result !== undefined ? request.result.value : fallback);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function setVal(key, value) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['store'], 'readwrite');
        const store = transaction.objectStore('store');
        const request = store.put({ id: key, value });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function pushHistory(snapshot) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['history'], 'readwrite');
        const store = transaction.objectStore('history');

        // Keep max 20 snapshots
        store.count().onsuccess = (e) => {
            if (e.target.result >= 20) {
                const cursorReq = store.openCursor();
                cursorReq.onsuccess = (ce) => {
                    const cursor = ce.target.result;
                    if (cursor) {
                        store.delete(cursor.primaryKey);
                    }
                };
            }
        };

        const request = store.put({ snapshot, timestamp: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function popHistory() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['history'], 'readwrite');
        const store = transaction.objectStore('history');
        const request = store.openCursor(null, 'prev');

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const snapshot = cursor.value.snapshot;
                store.delete(cursor.primaryKey);
                resolve(snapshot);
            } else {
                resolve(null);
            }
        };
        request.onerror = () => reject(request.error);
    });
}
