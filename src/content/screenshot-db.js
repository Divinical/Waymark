/**
 * IndexedDB Storage for Screenshots
 * Provides unlimited storage for large screenshot data
 * while keeping metadata in Chrome storage for fast access
 */

const CMBScreenshotDB = (() => {
  const DB_NAME = 'chapter-marker-screenshots';
  const DB_VERSION = 1;
  const STORE_NAME = 'screenshots';
  
  let db = null;

  /**
   * Initialize IndexedDB connection with error handling
   * @returns {Promise<IDBDatabase>}
   */
  async function initDB() {
    if (db) return db;

    return new Promise((resolve, reject) => {
      // Check if IndexedDB is available
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not supported or disabled'));
        return;
      }
      
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      // Add timeout for hanging requests
      const timeout = setTimeout(() => {
        reject(new Error('IndexedDB open timeout'));
      }, 10000);
      
      request.onerror = () => {
        clearTimeout(timeout);
        const error = request.error || new Error('IndexedDB open failed');
        console.error('IndexedDB initialization error:', error);
        reject(error);
      };
      
      request.onsuccess = () => {
        clearTimeout(timeout);
        db = request.result;
        
        // Add error handler for database
        db.onerror = (event) => {
          console.error('IndexedDB database error:', event.target.error);
        };
        
        // Handle database close/corruption
        db.onclose = () => {
          console.warn('IndexedDB database closed unexpectedly');
          db = null;
        };
        
        resolve(db);
      };
      
      request.onupgradeneeded = (event) => {
        try {
          const database = event.target.result;
          
          // Create screenshots store if it doesn't exist
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('markerId', 'markerId', { unique: false });
            store.createIndex('sessionKey', 'sessionKey', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
        } catch (error) {
          clearTimeout(timeout);
          console.error('IndexedDB upgrade error:', error);
          reject(error);
        }
      };
    });
  }

  /**
   * Store screenshot data in IndexedDB
   * @param {string} markerId - Unique marker ID
   * @param {string} sessionKey - Session key for grouping
   * @param {string} dataUrl - Screenshot data URL
   * @returns {Promise<string>} Screenshot ID
   */
  async function storeScreenshot(markerId, sessionKey, dataUrl) {
    await initDB();
    
    const screenshot = {
      id: `screenshot_${markerId}`,
      markerId: markerId,
      sessionKey: sessionKey,
      dataUrl: dataUrl,
      createdAt: Date.now(),
      size: dataUrl.length
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.put(screenshot);
      request.onsuccess = () => resolve(screenshot.id);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieve screenshot data from IndexedDB
   * @param {string} screenshotId - Screenshot ID
   * @returns {Promise<string|null>} Screenshot data URL or null
   */
  async function getScreenshot(screenshotId) {
    await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.get(screenshotId);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.dataUrl : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete screenshot from IndexedDB
   * @param {string} screenshotId - Screenshot ID
   * @returns {Promise<boolean>}
   */
  async function deleteScreenshot(screenshotId) {
    await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.delete(screenshotId);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete all screenshots for a session
   * @param {string} sessionKey - Session key
   * @returns {Promise<number>} Number of deleted screenshots
   */
  async function deleteSessionScreenshots(sessionKey) {
    await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('sessionKey');
      
      const request = index.openCursor(sessionKey);
      let deletedCount = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage stats
   */
  async function getStorageStats() {
    await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.getAll();
      request.onsuccess = () => {
        const screenshots = request.result;
        const totalSize = screenshots.reduce((sum, s) => sum + s.size, 0);
        const count = screenshots.length;
        
        resolve({
          screenshotCount: count,
          totalSize: totalSize,
          formattedSize: CMBUtils.formatFileSize(totalSize),
          avgSize: count > 0 ? Math.round(totalSize / count) : 0
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clean up old screenshots based on age
   * @param {number} maxAgeMs - Maximum age in milliseconds
   * @returns {Promise<number>} Number of deleted screenshots
   */
  async function cleanupOldScreenshots(maxAgeMs = 30 * 24 * 60 * 60 * 1000) { // 30 days default
    await initDB();
    
    const cutoffTime = Date.now() - maxAgeMs;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));
      let deletedCount = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Export all screenshots for backup
   * @returns {Promise<Array>} Screenshot metadata array
   */
  async function exportScreenshots() {
    await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Import screenshots from backup
   * @param {Array} screenshots - Screenshots to import
   * @returns {Promise<number>} Number of imported screenshots
   */
  async function importScreenshots(screenshots) {
    await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      let importedCount = 0;
      let index = 0;
      
      function importNext() {
        if (index >= screenshots.length) {
          resolve(importedCount);
          return;
        }
        
        const request = store.put(screenshots[index]);
        request.onsuccess = () => {
          importedCount++;
          index++;
          importNext();
        };
        request.onerror = () => reject(request.error);
      }
      
      importNext();
    });
  }

  return {
    storeScreenshot,
    getScreenshot,
    deleteScreenshot,
    deleteSessionScreenshots,
    getStorageStats,
    cleanupOldScreenshots,
    exportScreenshots,
    importScreenshots
  };
})();