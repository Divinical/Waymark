'use strict';

/**
 * Service Worker for Chapter Marker Buddy
 * Handles command relaying and screenshot capture
 */

// Command relay handler
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Send command to content script
    await chrome.tabs.sendMessage(tab.id, {
      type: 'COMMAND',
      command: command
    }).catch(err => {
      // Content script not loaded yet or incompatible page
      console.log(`Command ${command} failed:`, err.message);
    });
  } catch (error) {
    console.error('Command handling error:', error);
  }
});

// Action click handler (toolbar icon)
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'COMMAND',
      command: 'toggle-overlay'
    });
  } catch (error) {
    // Try injecting all content scripts if not present
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [
          'src/content/utils.js',
          'src/content/storage.js',
          'src/content/screenshot-db.js',
          'src/content/title-generator.js',
          'src/content/deeplinks.js',
          'src/content/exporters.js',
          'src/content/content.js'
        ]
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['src/content/overlay.css']
      });
      // Retry after injection with longer delay for initialization
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'COMMAND',
          command: 'toggle-overlay'
        }).catch(() => {});
      }, 500);
    } catch (err) {
      console.log('Cannot inject on this page:', err.message);
    }
  }
});

// Message handler for content script requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CAPTURE_SCREENSHOT') {
    captureScreenshot(sender.tab?.id, request.quality)
      .then(dataUrl => sendResponse({ success: true, dataUrl }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
  
  if (request.type === 'DOWNLOAD_FILE') {
    chrome.downloads.download({
      url: request.url,
      filename: request.filename,
      saveAs: request.saveAs || false
    }, (downloadId) => {
      sendResponse({ success: true, downloadId });
    });
    return true;
  }
  
  if (request.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }
  
  // Keep-alive handlers
  if (request.type === 'KEEP_ALIVE_START') {
    activeOperations++;
    sendResponse({ success: true });
    return false;
  }
  
  if (request.type === 'KEEP_ALIVE_END') {
    activeOperations = Math.max(0, activeOperations - 1);
    sendResponse({ success: true });
    return false;
  }
});

/**
 * Convert PNG data URL to WebP with compression
 * @param {string} pngDataUrl - PNG data URL
 * @param {number} quality - WebP quality (0-100)
 * @returns {Promise<string>} WebP data URL
 */
async function convertToWebP(pngDataUrl, quality = 75) {
  try {
    // Convert data URL to blob
    const response = await fetch(pngDataUrl);
    const blob = await response.blob();
    
    // Create ImageBitmap (service worker compatible)
    const imageBitmap = await createImageBitmap(blob);
    
    // Create OffscreenCanvas and draw the image
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageBitmap, 0, 0);
    
    // Convert to WebP with compression
    const webpBlob = await canvas.convertToBlob({
      type: 'image/webp',
      quality: quality / 100
    });
    
    // Convert blob back to data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(webpBlob);
    });
    
  } catch (error) {
    console.warn('WebP conversion failed, using original PNG:', error);
    return pngDataUrl; // Fallback to original PNG
  }
}

/**
 * Capture visible tab screenshot
 * @param {number} tabId - Tab ID to capture
 * @param {number} quality - WebP quality (0-100)
 * @returns {Promise<string>} Data URL of screenshot
 */
async function captureScreenshot(tabId, quality) {
  if (!tabId) throw new Error('No tab ID provided');
  
  try {
    // Ensure tab is focused for capture
    await chrome.tabs.update(tabId, { active: true });
    
    // Small delay to ensure tab is ready
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Capture in PNG first (Chrome API limitation)
    const pngDataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });
    
    // Convert to WebP for compression
    const webpDataUrl = await convertToWebP(pngDataUrl, quality || 75);
    
    return webpDataUrl;
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    throw new Error('Failed to capture screenshot: ' + error.message);
  }
}

// Installation handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Chapter Marker Buddy installed!');
    // Could open welcome page here
  } else if (details.reason === 'update') {
    console.log('Chapter Marker Buddy updated to version', chrome.runtime.getManifest().version);
  }
});

// Keep service worker alive during important operations
let activeOperations = 0;