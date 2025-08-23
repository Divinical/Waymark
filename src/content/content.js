'use strict';

/**
 * Chapter Marker Buddy - Main Content Script
 */

// Load dependencies
const scripts = [
  'src/content/utils.js',
  'src/content/storage.js',
  'src/content/deeplinks.js',
  'src/content/exporters.js'
];

// State management
let overlayContainer = null;
let currentSession = null;
let currentVideo = null;
let manualTimer = null;
let urlChangeCleanup = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let pendingScreenshot = null; // Store screenshot for next marker
let isInitialized = false;
let isInitializing = false;
let videoCheckInterval = null;
let cleanupCallbacks = [];

/**
 * Initialize the extension with error handling
 */
async function init() {
  if (isInitialized || isInitializing) return;
  isInitializing = true;
  
  try {
    console.log('Chapter Marker Buddy initializing...');
    
    // Load dependencies with timeout
    await Promise.race([
      loadDependencies(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Dependency loading timeout')), 10000))
    ]);
    
    // Inject overlay with error handling
    await injectOverlay();
    
    // Setup with error boundaries
    setupEventListeners();
    setupCleanupHandlers();
    
    // Initialize session management
    urlChangeCleanup = CMBUtils.installUrlChangeHook(handleUrlChange);
    addCleanupCallback(() => {
      if (urlChangeCleanup) urlChangeCleanup();
    });
    
    await initializeSession();
    
    // Start video monitoring with improved performance
    startVideoMonitoring();
    
    isInitialized = true;
    console.log('Chapter Marker Buddy ready!');
    
  } catch (error) {
    console.error('Chapter Marker Buddy initialization failed:', error);
    // Show user-friendly error if possible
    try {
      if (typeof CMBUtils !== 'undefined') {
        CMBUtils.showToast?.('Extension initialization failed', 'error');
      }
    } catch (e) {}
  } finally {
    isInitializing = false;
  }
}

/**
 * Add cleanup callback
 */
function addCleanupCallback(callback) {
  cleanupCallbacks.push(callback);
}

/**
 * Setup cleanup handlers
 */
function setupCleanupHandlers() {
  const cleanup = () => {
    console.log('Chapter Marker Buddy cleaning up...');
    
    // Clear intervals
    if (videoCheckInterval) clearInterval(videoCheckInterval);
    if (manualTimer?.interval) clearInterval(manualTimer.interval);
    
    // Run all cleanup callbacks
    cleanupCallbacks.forEach(callback => {
      try { 
        callback(); 
      } catch (e) { 
        console.error('Cleanup error:', e); 
      }
    });
    
    isInitialized = false;
  };
  
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('unload', cleanup);
  
  // Cleanup on extension disable/reload
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'EXTENSION_RELOAD') {
        cleanup();
      }
    });
  }
}

/**
 * Start video monitoring with improved performance
 */
function startVideoMonitoring() {
  let lastDetectedVideo = null;
  
  const checkVideo = () => {
    try {
      const video = CMBUtils.getActiveVideo();
      if (video !== lastDetectedVideo) {
        lastDetectedVideo = video;
        updateVideoStatus();
      }
    } catch (error) {
      console.error('Video detection error:', error);
    }
  };
  
  // Initial check
  checkVideo();
  
  // Reduced frequency polling
  videoCheckInterval = setInterval(checkVideo, 2000);
  
  addCleanupCallback(() => {
    if (videoCheckInterval) clearInterval(videoCheckInterval);
  });
}

/**
 * Load dependency scripts
 */
async function loadDependencies() {
  // In production, these would be bundled or loaded differently
  // For now, we assume they're already loaded via manifest
  
  // Wait for dependencies to be available
  const checkDependencies = () => {
    return typeof CMBUtils !== 'undefined' &&
           typeof CMBStorage !== 'undefined' &&
           typeof CMBDeepLinks !== 'undefined' &&
           typeof CMBExporters !== 'undefined';
  };
  
  if (!checkDependencies()) {
    // If dependencies aren't loaded, we need to inject them
    // This is a fallback for development
    console.warn('Dependencies not loaded, attempting manual injection...');
    
    for (const script of scripts) {
      const scriptEl = document.createElement('script');
      scriptEl.src = chrome.runtime.getURL(script);
      document.head.appendChild(scriptEl);
      await new Promise(resolve => scriptEl.onload = resolve);
    }
  }
}

/**
 * Inject overlay HTML into page
 */
async function injectOverlay() {
  // Check if already injected
  if (document.getElementById('cmb-overlay')) {
    overlayContainer = document.getElementById('cmb-overlay');
    return;
  }
  
  // Fetch overlay HTML
  const overlayUrl = chrome.runtime.getURL('src/content/overlay.html');
  const response = await fetch(overlayUrl);
  const html = await response.text();
  
  // Create container
  const container = document.createElement('div');
  container.innerHTML = html;
  overlayContainer = container.firstElementChild;
  
  // Add to page
  document.body.appendChild(overlayContainer);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
  
  // Chrome runtime messages
  chrome.runtime.onMessage.addListener(handleMessage);
  
  // Overlay controls
  setupOverlayControls();
  
  // Drag functionality
  setupDragAndDrop();
  
  // Video monitoring
  setInterval(updateVideoStatus, 1000);
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboard(e) {
  // Ignore if typing in input (except our own)
  const isTyping = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) &&
                   !e.target.classList.contains('cmb-title-input');
  if (isTyping) return;
  
  // Alt+M - Mark
  if (CMBUtils.onKeyCombo(e, { key: 'm', alt: true, shift: false })) {
    e.preventDefault();
    addMarker();
  }
  
  // Alt+Shift+M - Toggle overlay
  if (CMBUtils.onKeyCombo(e, { key: 'm', alt: true, shift: true })) {
    e.preventDefault();
    toggleOverlay();
  }
  
  // Alt+E - Export
  if (CMBUtils.onKeyCombo(e, { key: 'e', alt: true })) {
    e.preventDefault();
    showExportPanel();
  }
}

/**
 * Handle Chrome runtime messages
 */
function handleMessage(request, sender, sendResponse) {
  if (request.type === 'COMMAND') {
    switch (request.command) {
      case 'mark':
        addMarker();
        break;
      case 'toggle-overlay':
        toggleOverlay();
        break;
      case 'export':
        showExportPanel();
        break;
    }
  }
  sendResponse({ success: true });
}

/**
 * Setup overlay control buttons
 */
function setupOverlayControls() {
  const overlay = overlayContainer;
  
  // Close button
  overlay.querySelector('.cmb-btn-close').addEventListener('click', toggleOverlay);
  
  // Minimize button
  overlay.querySelector('.cmb-btn-minimize').addEventListener('click', minimizeOverlay);
  
  // Mark button
  overlay.querySelector('.cmb-btn-mark').addEventListener('click', addMarker);
  
  // Screenshot button
  overlay.querySelector('.cmb-btn-screenshot').addEventListener('click', takeScreenshot);
  
  // Undo button
  overlay.querySelector('.cmb-btn-undo').addEventListener('click', undoLastMarker);
  
  // Export button
  overlay.querySelector('.cmb-btn-export').addEventListener('click', showExportPanel);
  
  // More button
  overlay.querySelector('.cmb-btn-more').addEventListener('click', showMorePanel);
  
  // Export panel controls
  overlay.querySelector('.cmb-export-close').addEventListener('click', hideExportPanel);
  overlay.querySelectorAll('.cmb-export-buttons button').forEach(btn => {
    btn.addEventListener('click', (e) => exportFormat(e.target.dataset.format));
  });
  
  // More panel controls
  overlay.querySelector('.cmb-more-close').addEventListener('click', hideMorePanel);
  overlay.querySelector('.cmb-btn-clear-all').addEventListener('click', clearAllData);
  overlay.querySelector('.cmb-btn-export-all').addEventListener('click', exportAllData);
  overlay.querySelector('.cmb-btn-import').addEventListener('click', importData);
  overlay.querySelector('#cmb-manual-cleanup').addEventListener('click', manualCleanup);
  
  // Manual timer controls
  overlay.querySelector('.cmb-timer-start').addEventListener('click', startManualTimer);
  overlay.querySelector('.cmb-timer-pause').addEventListener('click', pauseManualTimer);
  overlay.querySelector('.cmb-timer-reset').addEventListener('click', resetManualTimer);
  
  // Minimized state click
  overlay.querySelector('.cmb-minimized').addEventListener('click', restoreOverlay);
  
  // Settings checkboxes
  overlay.querySelector('#cmb-insert-intro').addEventListener('change', saveSettings);
  overlay.querySelector('#cmb-auto-title-enabled').addEventListener('change', saveSettings);
  overlay.querySelector('#cmb-show-suggestions').addEventListener('change', (e) => {
    updateSuggestionsButtonVisibility();
    saveSettings();
  });
  overlay.querySelector('#cmb-auto-screenshot').addEventListener('change', saveSettings);
  
  // Screenshot quality slider
  overlay.querySelector('#cmb-screenshot-quality').addEventListener('input', (e) => {
    overlay.querySelector('#cmb-quality-value').textContent = e.target.value;
    saveSettings();
  });

  // Title suggestions
  overlay.querySelector('.cmb-btn-suggestions').addEventListener('click', showTitleSuggestions);
  
  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.cmb-title-section')) {
      hideTitleSuggestions();
    }
  });
}

/**
 * Setup drag and drop for overlay
 */
function setupDragAndDrop() {
  const header = overlayContainer.querySelector('.cmb-header');
  
  header.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    
    isDragging = true;
    const rect = overlayContainer.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
  });
}

function handleDrag(e) {
  if (!isDragging) return;
  
  const x = e.clientX - dragOffset.x;
  const y = e.clientY - dragOffset.y;
  
  // Keep within viewport with margin
  const margin = 10;
  const maxX = window.innerWidth - overlayContainer.offsetWidth - margin;
  const maxY = window.innerHeight - overlayContainer.offsetHeight - margin;
  
  const constrainedX = Math.max(margin, Math.min(x, maxX));
  const constrainedY = Math.max(margin, Math.min(y, maxY));
  
  overlayContainer.style.left = constrainedX + 'px';
  overlayContainer.style.top = constrainedY + 'px';
  overlayContainer.style.right = 'auto';
  overlayContainer.style.bottom = 'auto';
}

function stopDrag() {
  isDragging = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
  
  // Save position
  saveOverlayPosition();
}

/**
 * Initialize session
 */
async function initializeSession() {
  const url = location.href;
  const title = CMBUtils.getVideoTitle();
  
  currentSession = await CMBStorage.beginSession(url, title);
  
  // Load settings
  const settings = await CMBStorage.getSettings();
  overlayContainer.querySelector('#cmb-insert-intro').checked = settings.insertIntro;
  overlayContainer.querySelector('#cmb-screenshot-quality').value = settings.screenshotQuality || 75;
  overlayContainer.querySelector('#cmb-quality-value').textContent = settings.screenshotQuality || 75;
  overlayContainer.querySelector('#cmb-auto-title-enabled').checked = settings.autoTitleEnabled !== false;
  overlayContainer.querySelector('#cmb-show-suggestions').checked = settings.showSuggestions !== false;
  overlayContainer.querySelector('#cmb-auto-screenshot').checked = settings.autoScreenshot !== false;
  
  // Update UI based on settings
  updateSuggestionsButtonVisibility();
  
  // Update UI
  updateMarkerCount();
  updateSessionsList();
  
  // Run progressive cleanup if needed (once per day)
  checkAndRunProgressiveCleanup();
}

/**
 * Handle URL changes (SPA navigation)
 */
async function handleUrlChange(newUrl) {
  console.log('URL changed:', newUrl);
  
  // Save current session
  if (currentSession) {
    await CMBStorage.finalizeSession(currentSession);
  }
  
  // Start new session
  await initializeSession();
  
  // Reset UI
  overlayContainer.querySelector('.cmb-title-input').value = '';
  updateVideoStatus();
}

/**
 * Update video status
 */
function updateVideoStatus() {
  currentVideo = CMBUtils.getActiveVideo();
  const statusEl = overlayContainer.querySelector('.cmb-video-info');
  const manualTimerEl = overlayContainer.querySelector('.cmb-manual-timer');
  
  if (!currentVideo) {
    statusEl.textContent = 'No video detected';
    manualTimerEl.style.display = 'block';
    return;
  }
  
  // Check if we can read video time
  const currentTime = currentVideo.currentTime;
  if (isNaN(currentTime) || currentTime === undefined) {
    statusEl.textContent = 'Video detected (DRM protected)';
    manualTimerEl.style.display = 'block';
  } else {
    const duration = currentVideo.duration || 0;
    const durationStr = isFinite(duration) ? CMBExporters.formatTimestamp(duration) : '--:--';
    statusEl.textContent = `Video: ${CMBExporters.formatTimestamp(currentTime)} / ${durationStr}`;
    manualTimerEl.style.display = 'none';
  }
}

/**
 * Auto-take screenshot (silent, no UI feedback)
 */
async function autoTakeScreenshot() {
  if (!currentSession || pendingScreenshot) return; // Don't override existing pending screenshot
  
  const quality = parseInt(overlayContainer.querySelector('#cmb-screenshot-quality').value);
  
  try {
    const response = await Promise.race([
      chrome.runtime.sendMessage({ 
        type: 'CAPTURE_SCREENSHOT',
        quality: quality
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Screenshot timeout')), 8000) // Shorter timeout for auto
      )
    ]);
    
    if (response.success) {
      // Validate screenshot size
      if (response.dataUrl.length > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('Screenshot too large (>5MB)');
      }
      
      pendingScreenshot = response.dataUrl;
      // No UI feedback for auto-capture
    } else {
      throw new Error(response.error || 'Screenshot capture failed');
    }
  } catch (error) {
    console.warn('Auto-screenshot failed:', error);
    throw error; // Re-throw so caller can handle
  }
}

/**
 * Take screenshot for next marker
 */
async function takeScreenshot() {
  if (!currentSession) return;
  
  const screenshotBtn = overlayContainer.querySelector('.cmb-btn-screenshot');
  let retryCount = 0;
  const maxRetries = 2;
  
  try {
    screenshotBtn.innerHTML = '<span class="cmb-icon">📸</span> Taking...';
    screenshotBtn.disabled = true;
    
    const quality = parseInt(overlayContainer.querySelector('#cmb-screenshot-quality').value);
    
    // Retry logic for screenshot capture
    while (retryCount <= maxRetries) {
      try {
        const response = await Promise.race([
          chrome.runtime.sendMessage({ 
            type: 'CAPTURE_SCREENSHOT',
            quality: quality
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Screenshot timeout')), 10000)
          )
        ]);
        
        if (response.success) {
          // Validate screenshot size
          if (response.dataUrl.length > 5 * 1024 * 1024) { // 5MB limit
            throw new Error('Screenshot too large (>5MB)');
          }
          
          pendingScreenshot = response.dataUrl;
          screenshotBtn.innerHTML = '<span class="cmb-icon">✅</span> Ready';
          screenshotBtn.style.background = '#4CAF50';
          CMBUtils.showToast('Screenshot ready for next marker', 'success');
          return;
        } else {
          throw new Error(response.error || 'Screenshot capture failed');
        }
      } catch (attemptError) {
        retryCount++;
        if (retryCount <= maxRetries) {
          console.warn(`Screenshot attempt ${retryCount} failed:`, attemptError.message);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
        } else {
          throw attemptError;
        }
      }
    }
  } catch (error) {
    console.error('Screenshot failed after retries:', error);
    
    // Provide specific error messages
    let errorMessage = 'Screenshot failed';
    if (error.message.includes('timeout')) {
      errorMessage = 'Screenshot timed out - try again';
    } else if (error.message.includes('too large')) {
      errorMessage = 'Screenshot too large - reduce quality';
    } else if (error.message.includes('tab')) {
      errorMessage = 'Cannot capture this page type';
    }
    
    CMBUtils.showToast(errorMessage, 'error');
    
    // Reset button
    screenshotBtn.innerHTML = '<span class="cmb-icon">📸</span>';
    screenshotBtn.style.background = '';
  } finally {
    screenshotBtn.disabled = false;
  }
}

/**
 * Add a marker
 */
async function addMarker() {
  if (!currentSession) {
    CMBUtils.showToast('No active session', 'error');
    return;
  }
  
  // Get timestamp
  let seconds = 0;
  let useManualTimer = false;
  
  if (currentVideo && !isNaN(currentVideo.currentTime)) {
    seconds = Math.floor(currentVideo.currentTime);
  } else if (manualTimer && manualTimer.isActive) {
    seconds = getManualTimerSeconds();
    useManualTimer = true;
  } else {
    CMBUtils.showToast('No video time available. Start manual timer first.', 'error');
    return;
  }
  
  // Get title - use smart generation if empty
  const titleInput = overlayContainer.querySelector('.cmb-title-input');
  let title = titleInput.value.trim();
  
  if (!title) {
    // Check if auto-title generation is enabled
    const settings = await CMBStorage.getSettings();
    if (settings.autoTitleEnabled !== false) {
      // Generate smart title based on context
      try {
        const videoTitle = CMBUtils.getVideoTitle();
        const videoElement = CMBUtils.getActiveVideo();
        const totalDuration = videoElement?.duration || 3600; // Default 1 hour
        
        title = CMBTitleGenerator.generateTitle({
          videoTitle: videoTitle,
          url: location.href,
          timestamp: seconds,
          totalDuration: totalDuration,
          existingMarkers: currentSession.markers || []
        });
      } catch (error) {
        console.warn('Smart title generation failed, using fallback:', error);
        title = `Marker at ${CMBExporters.formatTimestamp(seconds)}`;
      }
    } else {
      // Auto-title disabled, use simple fallback
      title = `Marker at ${CMBExporters.formatTimestamp(seconds)}`;
    }
  }
  
  // Auto-capture screenshot if enabled and no pending screenshot
  const settings = await CMBStorage.getSettings();
  if (settings.autoScreenshot !== false && !pendingScreenshot) {
    try {
      await autoTakeScreenshot();
    } catch (error) {
      console.warn('Auto-screenshot failed:', error);
      // Continue with marker creation even if screenshot fails
    }
  }
  
  // Create marker
  const marker = {
    id: CMBUtils.generateId(),
    t: seconds,
    title: title,
    createdAt: Date.now()
  };
  
  // Add pending screenshot if available
  if (pendingScreenshot) {
    try {
      // Store screenshot in IndexedDB instead of Chrome storage
      const screenshotId = await CMBScreenshotDB.storeScreenshot(
        marker.id,
        CMBStorage.getSessionKey(location.href),
        pendingScreenshot
      );
      marker.screenshotId = screenshotId; // Store reference instead of data
      marker.hasScreenshot = true; // Flag for export/display logic
      
      // Clear pending screenshot
      pendingScreenshot = null;
      
      // Reset screenshot button
      const screenshotBtn = overlayContainer.querySelector('.cmb-btn-screenshot');
      screenshotBtn.innerHTML = '<span class="cmb-icon">📸</span>';
      screenshotBtn.style.background = '';
    } catch (error) {
      console.error('Failed to store screenshot:', error);
    }
  }
  
  // Add to session
  currentSession.markers.push(marker);
  
  // Save session
  await CMBStorage.saveSession(currentSession);
  
  // Update UI
  updateMarkerCount();
  CMBUtils.showToast(`Marker added: ${title}`, 'success');
  
  // Clear title for next marker
  titleInput.value = '';
}

/**
 * Undo last marker
 */
async function undoLastMarker() {
  if (!currentSession || !currentSession.markers.length) {
    CMBUtils.showToast('No markers to undo', 'error');
    return;
  }
  
  const removed = currentSession.markers.pop();
  await CMBStorage.saveSession(currentSession);
  
  updateMarkerCount();
  CMBUtils.showToast(`Removed: ${removed.title}`, 'success');
}

/**
 * Update marker count display
 */
function updateMarkerCount() {
  const count = currentSession?.markers?.length || 0;
  
  overlayContainer.querySelector('.cmb-marker-count').textContent = `${count} markers`;
  overlayContainer.querySelector('.cmb-mini-count').textContent = count;
  
  // Enable/disable buttons
  overlayContainer.querySelector('.cmb-btn-undo').disabled = count === 0;
  overlayContainer.querySelector('.cmb-btn-export').disabled = count === 0;
}

/**
 * Toggle overlay visibility
 */
function toggleOverlay() {
  const isVisible = overlayContainer.style.display !== 'none';
  overlayContainer.style.display = isVisible ? 'none' : 'block';
  
  if (!isVisible) {
    updateVideoStatus();
    updateMarkerCount();
  }
}

/**
 * Minimize overlay
 */
function minimizeOverlay() {
  overlayContainer.querySelector('.cmb-body').style.display = 'none';
  overlayContainer.querySelector('.cmb-header').style.display = 'none';
  overlayContainer.querySelector('.cmb-minimized').style.display = 'flex';
}

/**
 * Restore overlay from minimized
 */
function restoreOverlay() {
  overlayContainer.querySelector('.cmb-body').style.display = 'block';
  overlayContainer.querySelector('.cmb-header').style.display = 'flex';
  overlayContainer.querySelector('.cmb-minimized').style.display = 'none';
}

/**
 * Show export panel
 */
function showExportPanel() {
  if (!currentSession || !currentSession.markers.length) {
    CMBUtils.showToast('No markers to export', 'error');
    return;
  }
  
  overlayContainer.querySelector('.cmb-export-panel').style.display = 'block';
  
  // Show preview of YouTube chapters by default
  const preview = CMBExporters.toYouTubeChapters(currentSession, {
    insertIntro: overlayContainer.querySelector('#cmb-insert-intro').checked
  });
  overlayContainer.querySelector('.cmb-export-preview-text').value = preview;
}

/**
 * Hide export panel
 */
function hideExportPanel() {
  overlayContainer.querySelector('.cmb-export-panel').style.display = 'none';
}

/**
 * Export in specified format
 */
async function exportFormat(format) {
  if (!currentSession || !currentSession.markers.length) return;
  
  const insertIntro = overlayContainer.querySelector('#cmb-insert-intro').checked;
  let content = '';
  let filename = '';
  
  switch (format) {
    case 'youtube':
      content = CMBExporters.toYouTubeChapters(currentSession, { insertIntro });
      await CMBExporters.copyToClipboard(content);
      break;
      
    case 'markdown':
      content = CMBExporters.toMarkdown(currentSession);
      await CMBExporters.copyToClipboard(content);
      break;
      
    case 'csv':
      content = CMBExporters.toCSV(currentSession);
      filename = CMBExporters.generateFilename(currentSession, 'csv');
      await CMBExporters.downloadFile(content, filename, 'csv');
      break;
      
    case 'json':
      content = CMBExporters.toJSON(currentSession);
      filename = CMBExporters.generateFilename(currentSession, 'json');
      await CMBExporters.downloadFile(content, filename, 'json');
      break;
      
    case 'html':
      content = await CMBExporters.toHTML(currentSession);
      filename = CMBExporters.generateFilename(currentSession, 'html');
      await CMBExporters.downloadFile(content, filename, 'html');
      break;
  }
  
  // Update preview
  if (format === 'youtube' || format === 'markdown') {
    overlayContainer.querySelector('.cmb-export-preview-text').value = content;
  }
}

/**
 * Show more options panel
 */
async function showMorePanel() {
  overlayContainer.querySelector('.cmb-more-panel').style.display = 'block';
  
  await updateSessionsList();
  await updateStorageStats();
}

/**
 * Hide more panel
 */
function hideMorePanel() {
  overlayContainer.querySelector('.cmb-more-panel').style.display = 'none';
}

/**
 * Update sessions list
 */
async function updateSessionsList() {
  const sessions = await CMBStorage.listSessions();
  const container = overlayContainer.querySelector('.cmb-sessions-items');
  
  container.innerHTML = '';
  
  sessions.slice(0, 10).forEach(session => {
    const item = document.createElement('div');
    item.className = 'cmb-session-item';
    
    const info = document.createElement('div');
    info.className = 'cmb-session-info';
    
    const title = document.createElement('div');
    title.className = 'cmb-session-title';
    title.textContent = session.videoTitle || 'Untitled';
    
    const meta = document.createElement('div');
    meta.className = 'cmb-session-meta';
    meta.textContent = `${session.markers?.length || 0} markers • ${new Date(session.updatedAt).toLocaleDateString()}`;
    
    info.appendChild(title);
    info.appendChild(meta);
    
    const actions = document.createElement('div');
    actions.className = 'cmb-session-actions';
    
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', () => loadSession(session.key));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteSession(session.key));
    
    actions.appendChild(loadBtn);
    actions.appendChild(deleteBtn);
    
    item.appendChild(info);
    item.appendChild(actions);
    container.appendChild(item);
  });
  
  if (sessions.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #666;">No sessions yet</div>';
  }
}

/**
 * Update storage statistics
 */
async function updateStorageStats() {
  const stats = await CMBStorage.getStorageStats();
  const statsEl = overlayContainer.querySelector('.cmb-stats-info');
  statsEl.textContent = `Storage: ${stats.dataSize} • ${stats.sessionCount} sessions • ${stats.markerCount} total markers`;
}

/**
 * Load a session
 */
async function loadSession(key) {
  const session = await CMBStorage.getSession(key);
  if (session) {
    currentSession = session;
    updateMarkerCount();
    hideMorePanel();
    CMBUtils.showToast('Session loaded', 'success');
  }
}

/**
 * Delete a session
 */
async function deleteSession(key) {
  if (confirm('Delete this session and all its markers?')) {
    await CMBStorage.deleteSession(key);
    await updateSessionsList();
    await updateStorageStats();
  }
}

/**
 * Clear all data
 */
async function clearAllData() {
  if (confirm('This will delete ALL sessions and markers. Are you sure?')) {
    await CMBStorage.clearAllData();
    currentSession = null;
    await initializeSession();
    await updateSessionsList();
    await updateStorageStats();
  }
}

/**
 * Export all data
 */
async function exportAllData() {
  const data = await CMBStorage.exportAllData();
  if (data) {
    const json = JSON.stringify(data, null, 2);
    const filename = `chapter-marker-buddy-backup-${new Date().toISOString().split('T')[0]}.json`;
    await CMBExporters.downloadFile(json, filename, 'json');
  }
}

/**
 * Import data
 */
async function importData() {
  const input = document.getElementById('cmb-import-file');
  input.click();
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await CMBStorage.importData(data);
      await initializeSession();
      await updateSessionsList();
      await updateStorageStats();
    } catch (error) {
      CMBUtils.showToast('Failed to import data', 'error');
    }
  };
}

/**
 * Save settings
 */
async function saveSettings() {
  const settings = await CMBStorage.getSettings();
  settings.insertIntro = overlayContainer.querySelector('#cmb-insert-intro').checked;
  settings.screenshotQuality = parseInt(overlayContainer.querySelector('#cmb-screenshot-quality').value);
  settings.autoTitleEnabled = overlayContainer.querySelector('#cmb-auto-title-enabled').checked;
  settings.showSuggestions = overlayContainer.querySelector('#cmb-show-suggestions').checked;
  settings.autoScreenshot = overlayContainer.querySelector('#cmb-auto-screenshot').checked;
  await CMBStorage.saveSettings(settings);
}

/**
 * Manual cleanup triggered by user
 */
async function manualCleanup() {
  const cleanupBtn = overlayContainer.querySelector('#cmb-manual-cleanup');
  
  try {
    cleanupBtn.disabled = true;
    cleanupBtn.textContent = 'Cleaning...';
    
    const cleanedCount = await CMBStorage.progressiveCleanup();
    
    if (cleanedCount > 0) {
      CMBUtils.showToast(`Cleaned up ${cleanedCount} old items`, 'success');
    } else {
      CMBUtils.showToast('No cleanup needed', 'info');
    }
    
    // Refresh storage stats
    await updateStorageStats();
    
  } catch (error) {
    console.error('Manual cleanup failed:', error);
    CMBUtils.showToast('Cleanup failed', 'error');
  } finally {
    cleanupBtn.disabled = false;
    cleanupBtn.textContent = 'Run Cleanup';
  }
}

/**
 * Update storage analytics display
 */
async function updateStorageStats() {
  try {
    // Get Chrome storage stats
    const chromeStats = await CMBStorage.getStorageStats();
    overlayContainer.querySelector('#cmb-chrome-storage').textContent = chromeStats.dataSize;
    overlayContainer.querySelector('#cmb-session-count').textContent = chromeStats.sessionCount;
    overlayContainer.querySelector('#cmb-total-markers').textContent = chromeStats.markerCount;
    
    // Get IndexedDB screenshot stats
    if (typeof CMBScreenshotDB !== 'undefined') {
      try {
        const screenshotStats = await CMBScreenshotDB.getStorageStats();
        overlayContainer.querySelector('#cmb-screenshot-storage').textContent = 
          `${screenshotStats.formattedSize} (${screenshotStats.screenshotCount} images)`;
      } catch (error) {
        overlayContainer.querySelector('#cmb-screenshot-storage').textContent = 'Error loading';
      }
    } else {
      overlayContainer.querySelector('#cmb-screenshot-storage').textContent = 'Not available';
    }
    
    // Last cleanup info
    const settings = await CMBStorage.getSettings();
    const lastCleanup = settings.lastCleanup;
    const cleanupText = lastCleanup 
      ? `Last cleanup: ${new Date(lastCleanup).toLocaleDateString()}`
      : 'Last cleanup: Never';
    overlayContainer.querySelector('#cmb-last-cleanup').textContent = cleanupText;
    
  } catch (error) {
    console.error('Failed to update storage stats:', error);
  }
}

/**
 * Check if progressive cleanup is needed and run it
 */
async function checkAndRunProgressiveCleanup() {
  try {
    const settings = await CMBStorage.getSettings();
    const lastCleanup = settings.lastCleanup || 0;
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    // Run cleanup once per day
    if (lastCleanup < oneDayAgo) {
      console.log('Running progressive cleanup...');
      const cleanedCount = await CMBStorage.progressiveCleanup();
      
      if (cleanedCount > 0) {
        console.log(`Progressive cleanup completed: ${cleanedCount} items cleaned`);
      }
    }
  } catch (error) {
    console.error('Progressive cleanup check failed:', error);
  }
}

/**
 * Save overlay position
 */
async function saveOverlayPosition() {
  const rect = overlayContainer.getBoundingClientRect();
  const settings = await CMBStorage.getSettings();
  settings.overlayPosition = {
    left: rect.left,
    top: rect.top
  };
  await CMBStorage.saveSettings(settings);
}

// Manual timer functions
let manualTimerInterval = null;

function startManualTimer() {
  if (!manualTimer) {
    manualTimer = {
      isActive: true,
      startedAt: Date.now(),
      elapsedOffset: 0
    };
  } else {
    manualTimer.isActive = true;
    manualTimer.startedAt = Date.now();
  }
  
  overlayContainer.querySelector('.cmb-timer-start').disabled = true;
  overlayContainer.querySelector('.cmb-timer-pause').disabled = false;
  
  manualTimerInterval = setInterval(updateManualTimerDisplay, 100);
}

function pauseManualTimer() {
  if (!manualTimer) return;
  
  manualTimer.isActive = false;
  manualTimer.elapsedOffset += Date.now() - manualTimer.startedAt;
  
  overlayContainer.querySelector('.cmb-timer-start').disabled = false;
  overlayContainer.querySelector('.cmb-timer-pause').disabled = true;
  
  clearInterval(manualTimerInterval);
}

function resetManualTimer() {
  manualTimer = null;
  clearInterval(manualTimerInterval);
  
  overlayContainer.querySelector('.cmb-timer-start').disabled = false;
  overlayContainer.querySelector('.cmb-timer-pause').disabled = true;
  overlayContainer.querySelector('.cmb-timer-display').textContent = '00:00:00';
}

function updateManualTimerDisplay() {
  if (!manualTimer || !manualTimer.isActive) return;
  
  const elapsed = manualTimer.elapsedOffset + (Date.now() - manualTimer.startedAt);
  const seconds = Math.floor(elapsed / 1000);
  overlayContainer.querySelector('.cmb-timer-display').textContent = CMBExporters.formatTimestamp(seconds, true);
}

function getManualTimerSeconds() {
  if (!manualTimer) return 0;
  
  let elapsed = manualTimer.elapsedOffset;
  if (manualTimer.isActive) {
    elapsed += Date.now() - manualTimer.startedAt;
  }
  
  return Math.floor(elapsed / 1000);
}

/**
 * Update suggestions button visibility based on settings
 */
function updateSuggestionsButtonVisibility() {
  const suggestionsBtn = overlayContainer.querySelector('.cmb-btn-suggestions');
  const titleInput = overlayContainer.querySelector('.cmb-title-input');
  const showSuggestions = overlayContainer.querySelector('#cmb-show-suggestions').checked;
  
  if (suggestionsBtn && titleInput) {
    suggestionsBtn.style.display = showSuggestions ? 'flex' : 'none';
    // Adjust input padding based on button visibility (match status bar padding)
    titleInput.style.paddingRight = showSuggestions ? '40px' : '12px';
  }
}

/**
 * Show title suggestions panel
 */
function showTitleSuggestions() {
  if (!currentSession || typeof CMBTitleGenerator === 'undefined') return;
  
  const panel = overlayContainer.querySelector('.cmb-suggestions-panel');
  const list = overlayContainer.querySelector('.cmb-suggestions-list');
  const titleInput = overlayContainer.querySelector('.cmb-title-input');
  
  // Get current context
  let timestamp = 0;
  if (currentVideo && !isNaN(currentVideo.currentTime)) {
    timestamp = Math.floor(currentVideo.currentTime);
  } else if (manualTimer && manualTimer.isActive) {
    timestamp = getManualTimerSeconds();
  }
  
  const videoTitle = CMBUtils.getVideoTitle();
  const videoElement = CMBUtils.getActiveVideo();
  const totalDuration = videoElement?.duration || 3600;
  
  try {
    // Generate suggestions
    const suggestions = CMBTitleGenerator.getTitleSuggestions({
      videoTitle: videoTitle,
      url: location.href,
      timestamp: timestamp,
      totalDuration: totalDuration,
      existingMarkers: currentSession.markers || []
    });
    
    // Clear and populate suggestions list
    list.innerHTML = '';
    
    suggestions.forEach((suggestion, index) => {
      const item = document.createElement('div');
      item.className = `cmb-suggestion-item ${index === 0 ? 'primary' : ''}`;
      item.textContent = suggestion;
      item.addEventListener('click', () => selectSuggestion(suggestion));
      list.appendChild(item);
    });
    
    // Show panel
    panel.style.display = 'block';
    
  } catch (error) {
    console.error('Failed to generate suggestions:', error);
    CMBUtils.showToast('Failed to generate suggestions', 'error');
  }
}

/**
 * Hide title suggestions panel
 */
function hideTitleSuggestions() {
  const panel = overlayContainer.querySelector('.cmb-suggestions-panel');
  if (panel) {
    panel.style.display = 'none';
  }
}

/**
 * Select a suggestion and fill the input
 */
function selectSuggestion(suggestion) {
  const titleInput = overlayContainer.querySelector('.cmb-title-input');
  titleInput.value = suggestion;
  hideTitleSuggestions();
  titleInput.focus();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}