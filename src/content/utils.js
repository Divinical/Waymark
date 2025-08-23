'use strict';

/**
 * Utility functions for Chapter Marker Buddy
 */

window.CMBUtils = (() => {
  
  /**
   * Get the most appropriate active video element
   * @returns {HTMLVideoElement|null}
   */
  function getActiveVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (!videos.length) return null;
    
    // Filter visible videos
    const visibleVideos = videos.filter(v => {
      const rect = v.getBoundingClientRect();
      const style = window.getComputedStyle(v);
      return (
        rect.width > 0 && 
        rect.height > 0 && 
        style.display !== 'none' && 
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        v.readyState > 0
      );
    });
    
    if (!visibleVideos.length) return videos[0]; // Fallback to first video
    
    // Prefer playing videos
    const playingVideos = visibleVideos.filter(v => !v.paused);
    const candidates = playingVideos.length > 0 ? playingVideos : visibleVideos;
    
    // Return largest video by area
    return candidates.reduce((largest, video) => {
      const rect = video.getBoundingClientRect();
      const area = rect.width * rect.height;
      const largestRect = largest.getBoundingClientRect();
      const largestArea = largestRect.width * largestRect.height;
      return area > largestArea ? video : largest;
    });
  }
  
  /**
   * Check if key combo matches
   * @param {KeyboardEvent} e
   * @param {Object} combo - {key, alt, shift, ctrl, meta}
   * @returns {boolean}
   */
  function onKeyCombo(e, combo) {
    const keyMatch = e.key.toLowerCase() === combo.key.toLowerCase() ||
                     e.code.toLowerCase() === combo.key.toLowerCase();
    
    return keyMatch &&
           e.altKey === (combo.alt || false) &&
           e.shiftKey === (combo.shift || false) &&
           e.ctrlKey === (combo.ctrl || false) &&
           e.metaKey === (combo.meta || false);
  }
  
  /**
   * Install URL change detection hook
   * @param {Function} callback - Called with new URL on change
   * @returns {Function} Cleanup function
   */
  function installUrlChangeHook(callback) {
    let lastUrl = location.href;
    let urlCheckTimer = null;
    
    const checkUrl = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        callback(location.href);
      }
    };
    
    // Debounced check
    const debouncedCheck = () => {
      clearTimeout(urlCheckTimer);
      urlCheckTimer = setTimeout(checkUrl, 100);
    };
    
    // Hook history methods
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function() {
      originalPushState.apply(history, arguments);
      debouncedCheck();
    };
    
    history.replaceState = function() {
      originalReplaceState.apply(history, arguments);
      debouncedCheck();
    };
    
    // Listen to popstate
    window.addEventListener('popstate', debouncedCheck);
    
    // YouTube-specific navigation event
    document.addEventListener('yt-navigate-finish', debouncedCheck);
    
    // Mutation observer for fallback detection
    const observer = new MutationObserver(() => {
      debouncedCheck();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
    
    // Cleanup function
    return () => {
      clearTimeout(urlCheckTimer);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', debouncedCheck);
      document.removeEventListener('yt-navigate-finish', debouncedCheck);
      observer.disconnect();
    };
  }
  
  /**
   * Extract video ID from URL based on platform
   * @param {string} url
   * @returns {string}
   */
  function extractVideoId(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // YouTube
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        const videoId = urlObj.searchParams.get('v') || 
                       urlObj.pathname.split('/').pop();
        return videoId || 'youtube-unknown';
      }
      
      // Twitch
      if (hostname.includes('twitch.tv')) {
        const match = urlObj.pathname.match(/\/videos\/(\d+)/);
        if (match) return `twitch-${match[1]}`;
        const vParam = urlObj.searchParams.get('v');
        if (vParam) return `twitch-${vParam}`;
        return 'twitch-' + urlObj.pathname.replace(/\//g, '-');
      }
      
      // Vimeo
      if (hostname.includes('vimeo.com')) {
        const match = urlObj.pathname.match(/\/(\d+)/);
        if (match) return `vimeo-${match[1]}`;
        return 'vimeo-' + urlObj.pathname.replace(/\//g, '-');
      }
      
      // Generic fallback
      return hostname + urlObj.pathname.replace(/\//g, '-');
    } catch (error) {
      return 'unknown-' + Date.now();
    }
  }
  
  /**
   * Throttle function execution
   * @param {Function} func
   * @param {number} limit - Milliseconds
   * @returns {Function}
   */
  function throttle(func, limit) {
    let inThrottle;
    let lastResult;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        inThrottle = true;
        lastResult = func.apply(context, args);
        setTimeout(() => inThrottle = false, limit);
      }
      return lastResult;
    };
  }
  
  /**
   * Debounce function execution
   * @param {Function} func
   * @param {number} wait - Milliseconds
   * @returns {Function}
   */
  function debounce(func, wait) {
    let timeout;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
  
  /**
   * Generate unique ID
   * @returns {string}
   */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  
  /**
   * Get video title from page
   * @returns {string}
   */
  function getVideoTitle() {
    // YouTube
    const ytTitle = document.querySelector('h1.ytd-video-primary-info-renderer, h1.title, #title h1, ytd-watch-metadata h1');
    if (ytTitle?.textContent) return ytTitle.textContent.trim();
    
    // Twitch
    const twitchTitle = document.querySelector('[data-a-target="stream-title"], h2[data-test-selector="stream-info-card__title"]');
    if (twitchTitle?.textContent) return twitchTitle.textContent.trim();
    
    // Vimeo
    const vimeoTitle = document.querySelector('h1.iris_title, .vp-title');
    if (vimeoTitle?.textContent) return vimeoTitle.textContent.trim();
    
    // Generic fallbacks
    const genericTitle = document.querySelector('h1, title, meta[property="og:title"]');
    if (genericTitle) {
      const content = genericTitle.content || genericTitle.textContent;
      if (content) return content.trim();
    }
    
    return document.title || 'Untitled Video';
  }
  
  /**
   * Show toast notification
   * @param {string} message
   * @param {string} type - 'info', 'success', 'error'
   * @param {number} duration - Milliseconds
   */
  function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `cmb-toast cmb-toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#333'};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 2147483647;
      animation: cmb-slide-up 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'cmb-fade-out 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
  
  /**
   * Check if element is in viewport
   * @param {Element} element
   * @returns {boolean}
   */
  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }
  
  /**
   * Format file size
   * @param {number} bytes
   * @returns {string}
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
  
  return {
    getActiveVideo,
    onKeyCombo,
    installUrlChangeHook,
    extractVideoId,
    throttle,
    debounce,
    generateId,
    getVideoTitle,
    showToast,
    isInViewport,
    formatFileSize
  };
})();