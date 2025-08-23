'use strict';

/**
 * Storage management for Chapter Marker Buddy
 */

window.CMBStorage = (() => {
  const STORAGE_PREFIX = 'cmb';
  const SESSIONS_KEY = `${STORAGE_PREFIX}.sessions`;
  const LAST_ACTIVE_KEY = `${STORAGE_PREFIX}.lastActiveKey`;
  const SETTINGS_KEY = `${STORAGE_PREFIX}.settings`;
  
  /**
   * Check if storage is approaching quota limit
   */
  async function checkStorageQuota() {
    try {
      const storage = await chrome.storage.local.get(null);
      const dataSize = new Blob([JSON.stringify(storage)]).size;
      const quotaLimit = 5 * 1024 * 1024; // 5MB limit
      const warningThreshold = 0.8; // Warn at 80% usage
      
      if (dataSize >= quotaLimit) {
        CMBUtils.showToast('Storage full! Auto-cleanup running...', 'warning');
        await cleanupOldSessions();
        return false;
      } else if (dataSize >= quotaLimit * warningThreshold) {
        CMBUtils.showToast(`Storage ${Math.round((dataSize/quotaLimit)*100)}% full`, 'warning');
      }
      
      return true;
    } catch (error) {
      console.error('Storage quota check failed:', error);
      return true;
    }
  }

  /**
   * Perform progressive cleanup of old screenshots and sessions
   */
  async function progressiveCleanup() {
    try {
      let cleanedCount = 0;
      
      // Clean up screenshots older than 30 days
      if (typeof CMBScreenshotDB !== 'undefined') {
        try {
          const oldScreenshots = await CMBScreenshotDB.cleanupOldScreenshots(30 * 24 * 60 * 60 * 1000);
          cleanedCount += oldScreenshots;
          if (oldScreenshots > 0) {
            console.log(`Cleaned up ${oldScreenshots} old screenshots`);
          }
        } catch (error) {
          console.warn('Failed to cleanup old screenshots:', error);
        }
      }
      
      // Clean up sessions older than 90 days (keep screenshots until 30 days)
      const storage = await chrome.storage.local.get(SESSIONS_KEY);
      const sessions = storage[SESSIONS_KEY] || {};
      const sessionKeys = Object.keys(sessions);
      const oldSessionCutoff = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days
      
      const sessionsToDelete = sessionKeys.filter(key => {
        const session = sessions[key];
        return (session.updatedAt || session.createdAt || 0) < oldSessionCutoff;
      });
      
      for (const key of sessionsToDelete) {
        delete sessions[key];
        cleanedCount++;
      }
      
      if (sessionsToDelete.length > 0) {
        await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
        console.log(`Cleaned up ${sessionsToDelete.length} old sessions`);
      }
      
      // Save last cleanup timestamp
      const settings = await getSettings();
      settings.lastCleanup = Date.now();
      await saveSettings(settings);
      
      return cleanedCount;
    } catch (error) {
      console.error('Progressive cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Clean up old sessions to free storage space
   */
  async function cleanupOldSessions() {
    try {
      const storage = await chrome.storage.local.get(SESSIONS_KEY);
      const sessions = storage[SESSIONS_KEY] || {};
      const sessionKeys = Object.keys(sessions);
      
      if (sessionKeys.length <= 5) return; // Keep at least 5 sessions
      
      // Sort by updatedAt, keep 5 most recent
      const sortedSessions = sessionKeys
        .map(key => ({ key, session: sessions[key] }))
        .sort((a, b) => (b.session.updatedAt || 0) - (a.session.updatedAt || 0))
        .slice(5); // Remove oldest beyond 5
      
      // Delete old sessions and their screenshots
      for (const { key } of sortedSessions) {
        // Clean up screenshots from IndexedDB
        if (typeof CMBScreenshotDB !== 'undefined') {
          try {
            await CMBScreenshotDB.deleteSessionScreenshots(key);
          } catch (error) {
            console.warn(`Failed to cleanup screenshots for session ${key}:`, error);
          }
        }
        delete sessions[key];
      }
      
      await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
      CMBUtils.showToast(`Cleaned up ${sortedSessions.length} old sessions`, 'success');
      
    } catch (error) {
      console.error('Cleanup failed:', error);
      CMBUtils.showToast('Cleanup failed', 'error');
    }
  }

  // Save queue to prevent data loss during rapid saves
  let saveQueue = new Map();
  let saveInProgress = false;

  // Queued save function with retry logic
  async function queuedSave(key, data, retries = 3) {
    // Queue the latest data for this key
    saveQueue.set(key, data);
    
    // Process queue if not already in progress
    if (!saveInProgress) {
      saveInProgress = true;
      
      try {
        // Process all queued saves
        for (const [queueKey, queueData] of saveQueue.entries()) {
          let attempt = 0;
          let saved = false;
          
          while (attempt < retries && !saved) {
            try {
              // Check quota before saving
              const canSave = await checkStorageQuota();
              if (!canSave) {
                console.warn('Storage quota exceeded, skipping save');
                break;
              }
              
              await chrome.storage.local.set({ [queueKey]: queueData });
              saved = true;
              
            } catch (error) {
              attempt++;
              console.error(`Storage save attempt ${attempt} failed for key ${queueKey}:`, error);
              
              if (error.message?.includes('quota') || error.message?.includes('QuotaBytes')) {
                CMBUtils.showToast('Storage full! Try exporting data', 'error');
                await cleanupOldSessions();
                break; // Don't retry quota errors
              } else if (attempt >= retries) {
                CMBUtils.showToast('Failed to save data after retries', 'error');
              } else {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              }
            }
          }
        }
        
        // Clear processed saves
        saveQueue.clear();
        
      } finally {
        saveInProgress = false;
      }
    }
  }
  
  /**
   * Get current session key
   * @param {string} url
   * @returns {string}
   */
  function getSessionKey(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const videoId = CMBUtils.extractVideoId(url);
      const date = new Date().toISOString().split('T')[0];
      return `${hostname}|${videoId}|${date}`;
    } catch (error) {
      return `unknown|${Date.now()}`;
    }
  }
  
  /**
   * Begin a new session
   * @param {string} url
   * @param {string} title
   * @param {string} [key] - Optional custom key
   * @returns {Promise<Object>} The new session
   */
  async function beginSession(url, title, key) {
    const sessionKey = key || getSessionKey(url);
    const session = {
      url,
      videoTitle: title || CMBUtils.getVideoTitle(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      markers: [],
      manualTimer: null
    };
    
    try {
      const storage = await chrome.storage.local.get([SESSIONS_KEY, LAST_ACTIVE_KEY]);
      const sessions = storage[SESSIONS_KEY] || {};
      
      // Don't overwrite existing session
      if (!sessions[sessionKey]) {
        sessions[sessionKey] = session;
      } else {
        // Update existing session metadata
        sessions[sessionKey].updatedAt = Date.now();
        sessions[sessionKey].url = url; // Update URL in case of changes
        session.markers = sessions[sessionKey].markers; // Preserve markers
        session.createdAt = sessions[sessionKey].createdAt; // Preserve creation time
      }
      
      await chrome.storage.local.set({
        [SESSIONS_KEY]: sessions,
        [LAST_ACTIVE_KEY]: sessionKey
      });
      
      return sessions[sessionKey];
    } catch (error) {
      console.error('Failed to begin session:', error);
      return session;
    }
  }
  
  /**
   * Get a session by key
   * @param {string} key
   * @returns {Promise<Object|null>}
   */
  async function getSession(key) {
    try {
      const storage = await chrome.storage.local.get(SESSIONS_KEY);
      const sessions = storage[SESSIONS_KEY] || {};
      return sessions[key] || null;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }
  
  /**
   * Get current active session
   * @returns {Promise<Object|null>}
   */
  async function getCurrentSession() {
    try {
      const storage = await chrome.storage.local.get([SESSIONS_KEY, LAST_ACTIVE_KEY]);
      const sessions = storage[SESSIONS_KEY] || {};
      const activeKey = storage[LAST_ACTIVE_KEY];
      
      if (activeKey && sessions[activeKey]) {
        return { key: activeKey, session: sessions[activeKey] };
      }
      
      // Try to find session for current URL
      const currentKey = getSessionKey(location.href);
      if (sessions[currentKey]) {
        return { key: currentKey, session: sessions[currentKey] };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get current session:', error);
      return null;
    }
  }
  
  /**
   * Save a session
   * @param {Object} session
   * @param {string} [key] - Optional session key
   * @returns {Promise<void>}
   */
  async function saveSession(session, key) {
    try {
      const sessionKey = key || getSessionKey(session.url);
      session.updatedAt = Date.now();
      
      const storage = await chrome.storage.local.get(SESSIONS_KEY);
      const sessions = storage[SESSIONS_KEY] || {};
      sessions[sessionKey] = session;
      
      await queuedSave(SESSIONS_KEY, sessions);
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }
  
  /**
   * Finalize a session (final save)
   * @param {Object} session
   * @param {string} [key]
   * @returns {Promise<void>}
   */
  async function finalizeSession(session, key) {
    if (!session) return;
    
    try {
      session.updatedAt = Date.now();
      session.finalized = true;
      
      const sessionKey = key || getSessionKey(session.url);
      const storage = await chrome.storage.local.get(SESSIONS_KEY);
      const sessions = storage[SESSIONS_KEY] || {};
      sessions[sessionKey] = session;
      
      // Immediate save for finalization
      await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
    } catch (error) {
      console.error('Failed to finalize session:', error);
    }
  }
  
  /**
   * List all sessions
   * @returns {Promise<Array>}
   */
  async function listSessions() {
    try {
      const storage = await chrome.storage.local.get(SESSIONS_KEY);
      const sessions = storage[SESSIONS_KEY] || {};
      
      return Object.entries(sessions)
        .map(([key, session]) => ({ key, ...session }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error('Failed to list sessions:', error);
      return [];
    }
  }
  
  /**
   * Delete a session
   * @param {string} key
   * @returns {Promise<void>}
   */
  async function deleteSession(key) {
    try {
      const storage = await chrome.storage.local.get(SESSIONS_KEY);
      const sessions = storage[SESSIONS_KEY] || {};
      
      // Clean up screenshots from IndexedDB before deleting session
      if (typeof CMBScreenshotDB !== 'undefined') {
        try {
          const deletedCount = await CMBScreenshotDB.deleteSessionScreenshots(key);
          if (deletedCount > 0) {
            console.log(`Cleaned up ${deletedCount} screenshots for session ${key}`);
          }
        } catch (error) {
          console.warn('Failed to cleanup screenshots:', error);
        }
      }
      
      delete sessions[key];
      await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
      
      CMBUtils.showToast('Session deleted', 'success');
    } catch (error) {
      console.error('Failed to delete session:', error);
      CMBUtils.showToast('Failed to delete session', 'error');
    }
  }
  
  /**
   * Get settings
   * @returns {Promise<Object>}
   */
  async function getSettings() {
    try {
      const storage = await chrome.storage.local.get(SETTINGS_KEY);
      return storage[SETTINGS_KEY] || {
        screenshotQuality: 75,
        insertIntro: true,
        overlayPosition: { bottom: 20, right: 20 },
        defaultExportFormat: 'youtube',
        hotkeyEnabled: true
      };
    } catch (error) {
      console.error('Failed to get settings:', error);
      return {};
    }
  }
  
  /**
   * Save settings
   * @param {Object} settings
   * @returns {Promise<void>}
   */
  async function saveSettings(settings) {
    try {
      await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }
  
  /**
   * Clear all data
   * @returns {Promise<void>}
   */
  async function clearAllData() {
    try {
      await chrome.storage.local.clear();
      CMBUtils.showToast('All data cleared', 'success');
    } catch (error) {
      console.error('Failed to clear data:', error);
      CMBUtils.showToast('Failed to clear data', 'error');
    }
  }
  
  /**
   * Get storage statistics
   * @returns {Promise<Object>}
   */
  async function getStorageStats() {
    try {
      const storage = await chrome.storage.local.get(null);
      const dataSize = new Blob([JSON.stringify(storage)]).size;
      const sessions = storage[SESSIONS_KEY] || {};
      const sessionCount = Object.keys(sessions).length;
      const markerCount = Object.values(sessions).reduce((sum, s) => sum + (s.markers?.length || 0), 0);
      
      return {
        dataSize: CMBUtils.formatFileSize(dataSize),
        sessionCount,
        markerCount,
        bytesUsed: dataSize
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return { dataSize: '0 KB', sessionCount: 0, markerCount: 0 };
    }
  }
  
  /**
   * Export all data
   * @returns {Promise<Object>}
   */
  async function exportAllData() {
    try {
      const storage = await chrome.storage.local.get(null);
      return {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        data: storage
      };
    } catch (error) {
      console.error('Failed to export data:', error);
      return null;
    }
  }
  
  /**
   * Import data
   * @param {Object} data
   * @returns {Promise<boolean>}
   */
  async function importData(data) {
    try {
      if (!data?.data) throw new Error('Invalid import data');
      
      await chrome.storage.local.set(data.data);
      CMBUtils.showToast('Data imported successfully', 'success');
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      CMBUtils.showToast('Failed to import data', 'error');
      return false;
    }
  }
  
  return {
    getSessionKey,
    beginSession,
    getSession,
    getCurrentSession,
    saveSession,
    finalizeSession,
    listSessions,
    deleteSession,
    getSettings,
    saveSettings,
    clearAllData,
    progressiveCleanup,
    cleanupOldSessions,
    getStorageStats,
    exportAllData,
    importData
  };
})();