/**
 * IndexedDB Service for storing history data
 */

const DB_NAME = 'WeeklyReporterDB';
const DB_VERSION = 1;
const HISTORY_STORE = 'history';

class IndexedDBService {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize the database
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB opening failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create history object store if it doesn't exist
        if (!db.objectStoreNames.contains(HISTORY_STORE)) {
          const objectStore = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Get all history records
   */
  async getAllHistory() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([HISTORY_STORE], 'readonly');
      const objectStore = transaction.objectStore(HISTORY_STORE);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        // Sort by timestamp descending (newest first)
        const history = request.result.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        resolve(history);
      };

      request.onerror = () => {
        console.error('Failed to get history:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Add a history record
   */
  async addHistory(record) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([HISTORY_STORE], 'readwrite');
      const objectStore = transaction.objectStore(HISTORY_STORE);
      const request = objectStore.add(record);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Failed to add history:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete a history record by id
   */
  async deleteHistory(id) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([HISTORY_STORE], 'readwrite');
      const objectStore = transaction.objectStore(HISTORY_STORE);
      const request = objectStore.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to delete history:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all history records
   */
  async clearAllHistory() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([HISTORY_STORE], 'readwrite');
      const objectStore = transaction.objectStore(HISTORY_STORE);
      const request = objectStore.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to clear history:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Keep only the latest N records
   */
  async keepLatestRecords(maxRecords = 100) {
    if (!this.db) {
      await this.init();
    }

    const allHistory = await this.getAllHistory();
    
    if (allHistory.length > maxRecords) {
      // Delete older records
      const recordsToDelete = allHistory.slice(maxRecords);
      
      for (const record of recordsToDelete) {
        await this.deleteHistory(record.id);
      }
    }
  }
}

// Export a singleton instance
export const indexedDBService = new IndexedDBService();
