/**
 * IndexedDB Storage wrapper class
 * Provides a Promise-based API for using IndexedDB
 */
class IndexedDB {
    private static inst: IndexedDB | null = null;
    private db: IDBDatabase | null = null;
    private dbName: string = '';
    private storeName: string = '';
    private dbVersion: number = 1;

    constructor() {
        console.log('IndexedDB singleton created');
    }

    static async getInst(dbName: string, storeName: string, dbVersion: number) {
        // Create instance if it doesn't exist
        if (!IndexedDB.inst) {
            IndexedDB.inst = new IndexedDB();

            console.log("Waiting for DB")
            await IndexedDB.inst.initDB(dbName, storeName, dbVersion);
            console.log("DB ready")
        }

        return IndexedDB.inst;
    }

    /**
     * Initialize the IndexedDB database
     */
    async initDB(dbName: string, storeName: string, dbVersion: number) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.dbVersion = dbVersion;

        const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
            const request: IDBOpenDBRequest = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event: Event) => {
                console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
                reject((event.target as IDBOpenDBRequest).error);
            };

            request.onsuccess = (event: Event) => {
                resolve((event.target as IDBOpenDBRequest).result);
            };

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });

        this.db = await dbPromise;
    }

    /**
     * Store a value in the database
     * @param {string} key - The key to store the value under
     * @param {any} value - The value to store
     * @returns {Promise} Promise that resolves when the operation is complete
     */
    async setItem(key: string, value: any) {
        this.checkDB();
        try {
            return new Promise<void>((resolve, reject) => {
                const transaction = this.db!.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.put(value, key);

                request.onsuccess = () => resolve();
                request.onerror = (event: Event) => reject((event.target as IDBRequest).error);

                transaction.oncomplete = () => resolve();
                transaction.onerror = (event: Event) => reject((event.target as IDBTransaction).error);
            });
        } catch (error) {
            console.error('Error in setItem:', error);
            throw error;
        }
    }

    /**
     * Retrieve a value from the database
     * @param {string} key - The key to retrieve
     * @returns {Promise<any>} Promise that resolves with the retrieved value
     */
    async getItem(key: string) {
        this.checkDB();
        try {
            return new Promise<any>((resolve, reject) => {
                const transaction = this.db!.transaction(this.storeName, 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result);
                request.onerror = (event: Event) => reject((event.target as IDBRequest).error);
            });
        } catch (error) {
            console.error('Error in getItem:', error);
            throw error;
        }
    }

    /**
     * Remove a value from the database
     * @param {string} key - The key to remove
     * @returns {Promise} Promise that resolves when the operation is complete
     */
    async removeItem(key: string) {
        this.checkDB();
        try {
            return new Promise<void>((resolve, reject) => {
                const transaction = this.db!.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(key);

                request.onsuccess = () => resolve();
                request.onerror = (event: Event) => reject((event.target as IDBRequest).error);

                transaction.oncomplete = () => resolve();
                transaction.onerror = (event: Event) => reject((event.target as IDBTransaction).error);
            });
        } catch (error) {
            console.error('Error in removeItem:', error);
            throw error;
        }
    }

    /**
     * Clear all data from the store
     * @returns {Promise} Promise that resolves when the operation is complete
     */
    async clear() {
        this.checkDB();
        try {
            return new Promise<void>((resolve, reject) => {
                const transaction = this.db!.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = (event: Event) => reject((event.target as IDBRequest).error);

                transaction.oncomplete = () => resolve();
                transaction.onerror = (event: Event) => reject((event.target as IDBTransaction).error);
            });
        } catch (error) {
            console.error('Error in clear:', error);
            throw error;
        }
    }

    /**
     * Get all keys in the store
     * @returns {Promise<Array<string>>} Promise that resolves with an array of keys
     */
    async keys() {
        this.checkDB();
        try {
            return new Promise<string[]>((resolve, reject) => {
                const transaction = this.db!.transaction(this.storeName, 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAllKeys();

                request.onsuccess = () => resolve(request.result as string[]);
                request.onerror = (event: Event) => reject((event.target as IDBRequest).error);
            });
        } catch (error) {
            console.error('Error in keys:', error);
            throw error;
        }
    }

    checkDB() {
        if (!this.db) {
            throw new Error('Database not initialized. Call initDB() first, and inside getInstance() only.');
        }
    }
}

export default IndexedDB;