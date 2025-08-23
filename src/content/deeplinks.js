'use strict';

/**
 * Deep link generation for various video platforms
 */

window.CMBDeepLinks = (() => {
  
  /**
   * Build deep link for a given URL and timestamp
   * @param {string} url - Base URL
   * @param {number} seconds - Time in seconds
   * @returns {string} URL with timestamp
   */
  function buildDeepLink(url, seconds) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // YouTube
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        return buildYouTubeLink(urlObj, seconds);
      }
      
      // Twitch
      if (hostname.includes('twitch.tv')) {
        return buildTwitchLink(urlObj, seconds);
      }
      
      // Vimeo
      if (hostname.includes('vimeo.com')) {
        return buildVimeoLink(urlObj, seconds);
      }
      
      // Generic - return URL without timestamp
      return url;
    } catch (error) {
      console.error('Failed to build deep link:', error);
      return url;
    }
  }
  
  /**
   * Build YouTube deep link
   * @param {URL} urlObj
   * @param {number} seconds
   * @returns {string}
   */
  function buildYouTubeLink(urlObj, seconds) {
    // Remove any existing time parameter
    urlObj.searchParams.delete('t');
    urlObj.searchParams.delete('time_continue');
    urlObj.searchParams.delete('start');
    
    // For youtu.be short URLs
    if (urlObj.hostname === 'youtu.be') {
      urlObj.searchParams.set('t', `${Math.floor(seconds)}`);
    } else {
      // For youtube.com URLs
      urlObj.searchParams.set('t', `${Math.floor(seconds)}s`);
    }
    
    return urlObj.toString();
  }
  
  /**
   * Build Twitch deep link
   * @param {URL} urlObj
   * @param {number} seconds
   * @returns {string}
   */
  function buildTwitchLink(urlObj, seconds) {
    // Remove any existing time parameter
    urlObj.searchParams.delete('t');
    
    // Convert seconds to h/m/s format
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    // Build time string (omit zero units)
    let timeStr = '';
    if (hours > 0) timeStr += `${hours}h`;
    if (minutes > 0) timeStr += `${minutes}m`;
    if (secs > 0 || timeStr === '') timeStr += `${secs}s`;
    
    urlObj.searchParams.set('t', timeStr);
    return urlObj.toString();
  }
  
  /**
   * Build Vimeo deep link
   * @param {URL} urlObj
   * @param {number} seconds
   * @returns {string}
   */
  function buildVimeoLink(urlObj, seconds) {
    // Remove any existing hash
    urlObj.hash = '';
    
    // Convert seconds to m/s format for hash
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    if (minutes > 0) {
      urlObj.hash = `t=${minutes}m${secs}s`;
    } else {
      // Fallback to seconds only
      urlObj.hash = `t=${Math.floor(seconds)}s`;
    }
    
    return urlObj.toString();
  }
  
  /**
   * Format seconds for display in deep link
   * @param {number} seconds
   * @returns {Object} {hours, minutes, seconds, formatted}
   */
  function formatTimeComponents(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    let formatted = '';
    if (hours > 0) {
      formatted = `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      formatted = `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    return { hours, minutes, seconds: secs, formatted };
  }
  
  /**
   * Parse time parameter from URL
   * @param {string} url
   * @returns {number|null} Seconds or null if not found
   */
  function parseTimeFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // YouTube
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        const t = urlObj.searchParams.get('t') || urlObj.searchParams.get('start');
        if (t) {
          // Handle both formats: "123" and "123s"
          const seconds = parseInt(t.replace(/[^\d]/g, ''));
          if (!isNaN(seconds)) return seconds;
        }
      }
      
      // Twitch
      if (hostname.includes('twitch.tv')) {
        const t = urlObj.searchParams.get('t');
        if (t) {
          // Parse format like "1h2m3s"
          const match = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
          if (match) {
            const hours = parseInt(match[1] || 0);
            const minutes = parseInt(match[2] || 0);
            const seconds = parseInt(match[3] || 0);
            return hours * 3600 + minutes * 60 + seconds;
          }
        }
      }
      
      // Vimeo
      if (hostname.includes('vimeo.com') && urlObj.hash) {
        const match = urlObj.hash.match(/#t=(?:(\d+)m)?(\d+)s?/);
        if (match) {
          const minutes = parseInt(match[1] || 0);
          const seconds = parseInt(match[2] || 0);
          return minutes * 60 + seconds;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Get platform name from URL
   * @param {string} url
   * @returns {string}
   */
  function getPlatformName(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        return 'YouTube';
      }
      if (hostname.includes('twitch.tv')) {
        return 'Twitch';
      }
      if (hostname.includes('vimeo.com')) {
        return 'Vimeo';
      }
      
      // Extract domain name
      const domain = hostname.replace('www.', '').split('.')[0];
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch (error) {
      return 'Video';
    }
  }
  
  /**
   * Check if platform supports deep links
   * @param {string} url
   * @returns {boolean}
   */
  function supportsDeepLinks(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname.includes('youtube.com') ||
             hostname.includes('youtu.be') ||
             hostname.includes('twitch.tv') ||
             hostname.includes('vimeo.com');
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Generate share text with deep link
   * @param {string} url
   * @param {number} seconds
   * @param {string} title
   * @returns {string}
   */
  function generateShareText(url, seconds, title) {
    const deepLink = buildDeepLink(url, seconds);
    const time = formatTimeComponents(seconds);
    const platform = getPlatformName(url);
    
    if (title) {
      return `${title} at ${time.formatted} - ${deepLink}`;
    } else {
      return `${platform} video at ${time.formatted} - ${deepLink}`;
    }
  }
  
  /**
   * Validate URL format
   * @param {string} url
   * @returns {boolean}
   */
  function isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  return {
    buildDeepLink,
    buildYouTubeLink,
    buildTwitchLink,
    buildVimeoLink,
    formatTimeComponents,
    parseTimeFromUrl,
    getPlatformName,
    supportsDeepLinks,
    generateShareText,
    isValidUrl
  };
})();