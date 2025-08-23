'use strict';

/**
 * Export functions for Chapter Marker Buddy
 */

window.CMBExporters = (() => {
  
  /**
   * Format timestamp for display
   * @param {number} seconds
   * @param {boolean} forceHours - Always show hours
   * @returns {string}
   */
  function formatTimestamp(seconds, forceHours = false) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0 || forceHours) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Export as YouTube chapters format
   * @param {Object} session
   * @param {Object} options
   * @returns {string}
   */
  function toYouTubeChapters(session, options = {}) {
    const { insertIntro = true } = options;
    
    if (!session || !session.markers) return '';
    
    // Sort markers by time
    let markers = [...session.markers].sort((a, b) => a.t - b.t);
    
    // Check if we need to insert 00:00 intro
    if (insertIntro && (!markers.length || markers[0].t !== 0)) {
      markers.unshift({
        t: 0,
        title: 'Intro',
        id: 'intro-auto'
      });
    }
    
    // Format each marker
    const lines = markers.map(marker => {
      const timestamp = formatTimestamp(marker.t, false);
      const title = marker.title || 'Chapter';
      return `${timestamp} ${title}`;
    });
    
    return lines.join('\n');
  }
  
  /**
   * Export as Markdown with deep links
   * @param {Object} session
   * @returns {string}
   */
  function toMarkdown(session) {
    if (!session || !session.markers) return '';
    
    const platformName = CMBDeepLinks.getPlatformName(session.url);
    const supportsDeepLinks = CMBDeepLinks.supportsDeepLinks(session.url);
    
    // Build header
    let markdown = `# ${session.videoTitle || 'Video Chapters'}\n\n`;
    markdown += `**Platform:** ${platformName}\n`;
    markdown += `**URL:** ${session.url}\n`;
    markdown += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n`;
    markdown += `**Total Markers:** ${session.markers.length}\n\n`;
    markdown += `## Chapters\n\n`;
    
    // Sort markers by time
    const sortedMarkers = [...session.markers].sort((a, b) => a.t - b.t);
    
    // Add each marker
    sortedMarkers.forEach(marker => {
      const timestamp = formatTimestamp(marker.t, true);
      const title = marker.title || 'Untitled';
      
      if (supportsDeepLinks) {
        const deepLink = CMBDeepLinks.buildDeepLink(session.url, marker.t);
        markdown += `- **${timestamp}** – [${title}](${deepLink})\n`;
      } else {
        markdown += `- **${timestamp}** – ${title}\n`;
      }
    });
    
    return markdown;
  }
  
  /**
   * Export as CSV
   * @param {Object} session
   * @returns {string}
   */
  function toCSV(session) {
    if (!session || !session.markers) return '';
    
    // CSV header
    const headers = ['timestamp', 'title', 'seconds', 'source_url', 'created_at'];
    const rows = [headers];
    
    // Sort markers by time
    const sortedMarkers = [...session.markers].sort((a, b) => a.t - b.t);
    
    // Add each marker as a row
    sortedMarkers.forEach(marker => {
      const row = [
        formatTimestamp(marker.t, true),
        escapeCSV(marker.title || 'Untitled'),
        marker.t,
        session.url,
        new Date(marker.createdAt || session.createdAt).toISOString()
      ];
      rows.push(row);
    });
    
    // Convert to CSV string
    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }
  
  /**
   * Export as JSON
   * @param {Object} session
   * @returns {string}
   */
  function toJSON(session) {
    if (!session || !session.markers) return '{}';
    
    // Sort markers by time
    const sortedMarkers = [...session.markers].sort((a, b) => a.t - b.t);
    
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      url: session.url,
      videoTitle: session.videoTitle || 'Untitled Video',
      platform: CMBDeepLinks.getPlatformName(session.url),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      markers: sortedMarkers.map(marker => ({
        t: marker.t,
        timestamp: formatTimestamp(marker.t, true),
        title: marker.title || 'Untitled',
        deepLink: CMBDeepLinks.supportsDeepLinks(session.url) 
          ? CMBDeepLinks.buildDeepLink(session.url, marker.t)
          : null,
        hasScreenshot: !!marker.screenshotDataUrl,
        createdAt: marker.createdAt
      })),
      stats: {
        totalMarkers: sortedMarkers.length,
        duration: sortedMarkers.length > 0 ? sortedMarkers[sortedMarkers.length - 1].t : 0,
        hasScreenshots: sortedMarkers.some(m => m.hasScreenshot || m.screenshotDataUrl)
      }
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  /**
   * Export with screenshots as HTML
   * @param {Object} session
   * @returns {Promise<string>}
   */
  async function toHTML(session) {
    if (!session || !session.markers) return '';
    
    const sortedMarkers = [...session.markers].sort((a, b) => a.t - b.t);
    const platformName = CMBDeepLinks.getPlatformName(session.url);
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(session.videoTitle || 'Video Chapters')}</title>
  <style>
    :root {
      --primary-color: #4CAF50;
      --primary-dark: #45a049;
      --secondary-color: #2196F3;
      --background-color: #f8fafc;
      --surface-color: #ffffff;
      --text-primary: #1a202c;
      --text-secondary: #4a5568;
      --text-muted: #718096;
      --border-color: #e2e8f0;
      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
      --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
      --border-radius: 12px;
      --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    [data-theme="dark"] {
      --background-color: #1a202c;
      --surface-color: #2d3748;
      --text-primary: #f7fafc;
      --text-secondary: #e2e8f0;
      --text-muted: #a0aec0;
      --border-color: #4a5568;
      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.4);
      --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
      background: linear-gradient(135deg, var(--background-color) 0%, #f1f5f9 100%);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
    }

    .header {
      text-align: center;
      margin-bottom: 48px;
      padding: 32px 0;
      background: var(--surface-color);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-md);
    }

    h1 {
      color: var(--text-primary);
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0 0 16px 0;
      background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: 1.1rem;
      margin: 0;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
      margin-bottom: 48px;
    }

    .meta-card {
      background: var(--surface-color);
      padding: 24px;
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      transition: var(--transition);
    }

    .meta-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }

    .meta-label {
      font-weight: 600;
      color: var(--text-secondary);
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }

    .meta-value {
      color: var(--text-primary);
      font-size: 1.1rem;
      font-weight: 500;
    }

    .meta-value a {
      color: var(--primary-color);
      text-decoration: none;
      word-break: break-all;
    }

    .meta-value a:hover {
      text-decoration: underline;
    }

    .stats-summary {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-bottom: 48px;
      flex-wrap: wrap;
    }

    .stat-item {
      text-align: center;
      padding: 16px 24px;
      background: var(--surface-color);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-sm);
      min-width: 120px;
    }

    .stat-number {
      font-size: 2rem;
      font-weight: 700;
      color: var(--primary-color);
      display: block;
    }

    .stat-label {
      font-size: 0.9rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .timeline-container {
      position: relative;
      margin-bottom: 24px;
    }

    .timeline-line {
      position: absolute;
      left: 24px;
      top: 0;
      bottom: 0;
      width: 4px;
      background: linear-gradient(to bottom, var(--primary-color), var(--secondary-color));
      border-radius: 2px;
      opacity: 0.3;
    }

    .markers-grid {
      display: grid;
      gap: 24px;
    }

    .marker {
      background: var(--surface-color);
      border-radius: var(--border-radius);
      padding: 32px;
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      position: relative;
      transition: var(--transition);
      overflow: hidden;
    }

    .marker::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(to bottom, var(--primary-color), var(--secondary-color));
    }

    .marker:hover {
      transform: translateX(4px);
      box-shadow: var(--shadow-md);
    }

    .marker-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .timestamp {
      background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
      color: white;
      padding: 10px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.95rem;
      letter-spacing: 0.02em;
      box-shadow: var(--shadow-sm);
      flex-shrink: 0;
    }

    .marker-title {
      font-size: 1.4rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      flex: 1;
      min-width: 200px;
    }

    .marker-content {
      margin-top: 20px;
    }

    .screenshot {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin-top: 16px;
      box-shadow: var(--shadow-md);
      transition: var(--transition);
    }

    .screenshot:hover {
      transform: scale(1.02);
    }

    .deep-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding: 12px 20px;
      background: linear-gradient(135deg, var(--secondary-color) 0%, #1976D2 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: var(--transition);
      box-shadow: var(--shadow-sm);
    }

    .deep-link:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      text-decoration: none;
      color: white;
    }

    .deep-link::after {
      content: '→';
      font-weight: bold;
    }

    .controls {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-bottom: 32px;
      flex-wrap: wrap;
    }

    .search-box {
      padding: 12px 16px;
      border: 2px solid var(--border-color);
      border-radius: 8px;
      background: var(--surface-color);
      color: var(--text-primary);
      font-size: 1rem;
      min-width: 300px;
      transition: var(--transition);
    }

    .search-box:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
    }

    .theme-toggle {
      padding: 12px 20px;
      background: var(--surface-color);
      border: 2px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      cursor: pointer;
      font-size: 1rem;
      font-weight: 500;
      transition: var(--transition);
    }

    .theme-toggle:hover {
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }

    .marker.hidden {
      display: none;
    }

    .no-results {
      text-align: center;
      padding: 48px 24px;
      color: var(--text-muted);
      font-size: 1.1rem;
      display: none;
    }

    .footer {
      margin-top: 64px;
      text-align: center;
      padding: 32px;
      background: var(--surface-color);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-sm);
      color: var(--text-muted);
    }

    /* Mobile Responsive Design */
    @media (max-width: 768px) {
      body {
        padding: 16px;
      }

      .header {
        padding: 24px 16px;
        margin-bottom: 32px;
      }

      h1 {
        font-size: 2rem;
      }

      .meta-grid {
        grid-template-columns: 1fr;
        gap: 16px;
        margin-bottom: 32px;
      }

      .meta-card {
        padding: 16px;
      }

      .stats-summary {
        gap: 16px;
        margin-bottom: 32px;
      }

      .stat-item {
        padding: 12px 16px;
        min-width: 100px;
      }

      .stat-number {
        font-size: 1.5rem;
      }

      .marker {
        padding: 20px;
      }

      .marker-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }

      .marker-title {
        font-size: 1.2rem;
      }

      .timestamp {
        align-self: flex-start;
      }

      .markers-grid {
        gap: 16px;
      }

      .timeline-line {
        display: none;
      }
    }

    @media (max-width: 480px) {
      h1 {
        font-size: 1.75rem;
      }

      .marker-header {
        gap: 8px;
      }

      .marker-title {
        font-size: 1.1rem;
      }

      .stats-summary {
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
      }

      .stat-number {
        font-size: 1.25rem;
      }

      .stat-label {
        font-size: 0.8rem;
      }

      .deep-link {
        padding: 10px 16px;
        font-size: 0.9rem;
      }
    }

    @media print {
      body {
        background: white;
        padding: 0;
        max-width: none;
      }
      
      .header, .meta-card, .marker, .footer {
        box-shadow: none;
        border: 1px solid #ddd;
      }

      .marker:hover {
        transform: none;
      }
      
      .screenshot:hover {
        transform: none;
      }
      
      .deep-link:hover {
        transform: none;
      }

      .timeline-line {
        display: none;
      }

      .stats-summary {
        break-inside: avoid;
      }

      .marker {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(session.videoTitle || 'Video Chapters')}</h1>
    <p class="subtitle">Created with Chapter Marker Buddy</p>
  </div>
  
  <div class="meta-grid">
    <div class="meta-card">
      <div class="meta-label">Platform</div>
      <div class="meta-value">${escapeHtml(platformName)}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Source URL</div>
      <div class="meta-value"><a href="${escapeHtml(session.url)}" target="_blank">${escapeHtml(session.url)}</a></div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Created Date</div>
      <div class="meta-value">${new Date(session.createdAt).toLocaleDateString()} at ${new Date(session.createdAt).toLocaleTimeString()}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Duration</div>
      <div class="meta-value">${sortedMarkers.length > 0 ? formatTimestamp(sortedMarkers[sortedMarkers.length - 1].t, true) : '0:00'}</div>
    </div>
  </div>

  <div class="stats-summary">
    <div class="stat-item">
      <span class="stat-number">${sortedMarkers.length}</span>
      <span class="stat-label">Markers</span>
    </div>
    <div class="stat-item">
      <span class="stat-number">${sortedMarkers.filter(m => m.hasScreenshot || m.screenshotDataUrl || m.screenshotId).length}</span>
      <span class="stat-label">Screenshots</span>
    </div>
    <div class="stat-item">
      <span class="stat-number">${Math.round((sortedMarkers.length > 0 ? sortedMarkers[sortedMarkers.length - 1].t : 0) / 60)}</span>
      <span class="stat-label">Minutes</span>
    </div>
  </div>

  <div class="controls">
    <input type="text" class="search-box" placeholder="Search markers..." id="searchBox">
    <button class="theme-toggle" onclick="toggleTheme()" id="themeToggle">🌙 Dark Mode</button>
  </div>
  
  <div class="timeline-container">
    <div class="timeline-line"></div>
    <div class="markers-grid" id="markersGrid">`;
    
    // Process markers sequentially to handle async screenshot loading
    for (const marker of sortedMarkers) {
      const timestamp = formatTimestamp(marker.t, true);
      const deepLink = CMBDeepLinks.supportsDeepLinks(session.url) 
        ? CMBDeepLinks.buildDeepLink(session.url, marker.t)
        : session.url;
      
      html += `
    <div class="marker">
      <div class="marker-header">
        <div class="timestamp">${timestamp}</div>
        <h3 class="marker-title">${escapeHtml(marker.title || 'Untitled')}</h3>
      </div>
      <div class="marker-content">`;
      
      // Handle both old and new screenshot storage systems with validation
      if (marker.screenshotDataUrl) {
        // Legacy: direct data URL storage
        const validDataUrl = validateDataUrl(marker.screenshotDataUrl);
        if (validDataUrl) {
          html += `
      <img class="screenshot" src="${validDataUrl}" alt="Screenshot at ${escapeHtml(timestamp)}">`;
        }
      } else if (marker.screenshotId) {
        // New: IndexedDB reference storage
        try {
          const screenshotDataUrl = await CMBScreenshotDB.getScreenshot(marker.screenshotId);
          const validDataUrl = validateDataUrl(screenshotDataUrl);
          if (validDataUrl) {
            html += `
      <img class="screenshot" src="${validDataUrl}" alt="Screenshot at ${escapeHtml(timestamp)}">`;
          }
        } catch (error) {
          console.warn('Failed to load screenshot for marker:', marker.id, error);
        }
      }
      
      if (CMBDeepLinks.supportsDeepLinks(session.url)) {
        html += `
        <a class="deep-link" href="${escapeHtml(deepLink)}" target="_blank">Jump to this moment</a>`;
      }
      
      html += `
      </div>
    </div>`;
    }
    
    html += `
    </div>
    
    <div class="no-results" id="noResults">
      <p>No markers found matching your search.</p>
    </div>
  </div>
  
  <div class="footer">
    <p>Generated by <strong>Chapter Marker Buddy</strong> - ${new Date().toLocaleDateString()}</p>
  </div>

  <script>
    // Theme management
    function toggleTheme() {
      const body = document.body;
      const themeToggle = document.getElementById('themeToggle');
      const currentTheme = body.getAttribute('data-theme');
      
      if (currentTheme === 'dark') {
        body.removeAttribute('data-theme');
        themeToggle.textContent = '🌙 Dark Mode';
        localStorage.setItem('theme', 'light');
      } else {
        body.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️ Light Mode';
        localStorage.setItem('theme', 'dark');
      }
    }

    // Initialize theme from localStorage
    document.addEventListener('DOMContentLoaded', function() {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        document.getElementById('themeToggle').textContent = '☀️ Light Mode';
      }
    });

    // Search functionality
    document.getElementById('searchBox').addEventListener('input', function(e) {
      const searchTerm = e.target.value.toLowerCase().trim();
      const markers = document.querySelectorAll('.marker');
      const noResults = document.getElementById('noResults');
      let visibleCount = 0;

      markers.forEach(marker => {
        const title = marker.querySelector('.marker-title').textContent.toLowerCase();
        const timestamp = marker.querySelector('.timestamp').textContent.toLowerCase();
        const isVisible = title.includes(searchTerm) || timestamp.includes(searchTerm);
        
        if (isVisible) {
          marker.classList.remove('hidden');
          visibleCount++;
        } else {
          marker.classList.add('hidden');
        }
      });

      // Show/hide no results message
      noResults.style.display = (visibleCount === 0 && searchTerm !== '') ? 'block' : 'none';
    });

    // Add keyboard shortcut for search
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        document.getElementById('searchBox').focus();
      }
    });
  </script>
</body>
</html>`;
    
    return html;
  }
  
  /**
   * Create download blob
   * @param {string} content
   * @param {string} type
   * @returns {Blob}
   */
  function createBlob(content, type) {
    const mimeTypes = {
      'txt': 'text/plain',
      'md': 'text/markdown',
      'csv': 'text/csv',
      'json': 'application/json',
      'html': 'text/html'
    };
    
    return new Blob([content], { type: mimeTypes[type] || 'text/plain' });
  }
  
  /**
   * Trigger download
   * @param {string} content
   * @param {string} filename
   * @param {string} type
   */
  async function downloadFile(content, filename, type) {
    const blob = createBlob(content, type);
    const url = URL.createObjectURL(blob);
    
    try {
      // Use Chrome downloads API if available
      if (chrome.downloads) {
        await chrome.runtime.sendMessage({
          type: 'DOWNLOAD_FILE',
          url: url,
          filename: filename,
          saveAs: true
        });
      } else {
        // Fallback to link click
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
      }
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  
  /**
   * Copy text to clipboard
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      CMBUtils.showToast('Copied to clipboard!', 'success');
      return true;
    } catch (error) {
      // Fallback method
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      
      try {
        document.execCommand('copy');
        CMBUtils.showToast('Copied to clipboard!', 'success');
        return true;
      } catch (err) {
        CMBUtils.showToast('Failed to copy to clipboard', 'error');
        return false;
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }
  
  /**
   * Properly escape CSV value  
   * @param {string} value
   * @returns {string}
   */
  function escapeCSV(value) {
    if (typeof value !== 'string') return value || '';
    
    // Prevent CSV injection attacks
    if (/^[=+\-@]/.test(value)) {
      value = "'" + value; // Prefix with single quote to prevent formula execution
    }
    
    // If value contains comma, newline, or quote, wrap in quotes and escape internal quotes
    if (/[,"\r\n]/.test(value)) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    
    return value;
  }
  
  /**
   * Escape HTML characters with enhanced security
   * @param {string} text
   * @returns {string}
   */
  function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Validate and sanitize data URL
   * @param {string} dataUrl
   * @returns {string|null}
   */
  function validateDataUrl(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    
    // Only allow image data URLs
    const validFormats = ['data:image/jpeg', 'data:image/png', 'data:image/webp'];
    if (!validFormats.some(format => dataUrl.startsWith(format))) {
      return null;
    }
    
    // Basic size check (10MB limit)
    if (dataUrl.length > 10 * 1024 * 1024) {
      console.warn('Data URL too large, skipping');
      return null;
    }
    
    return dataUrl;
  }

  /**
   * Validate marker data
   * @param {Object} marker
   * @returns {Object}
   */
  function validateMarker(marker) {
    if (!marker || typeof marker !== 'object') return null;
    
    return {
      t: typeof marker.t === 'number' && marker.t >= 0 ? marker.t : 0,
      title: typeof marker.title === 'string' ? marker.title.substring(0, 200) : 'Untitled',
      id: marker.id || 'unknown',
      createdAt: typeof marker.createdAt === 'number' ? marker.createdAt : Date.now(),
      hasScreenshot: Boolean(marker.hasScreenshot || marker.screenshotDataUrl || marker.screenshotId)
    };
  }
  
  /**
   * Generate filename
   * @param {Object} session
   * @param {string} extension
   * @returns {string}
   */
  function generateFilename(session, extension) {
    const videoTitle = (session.videoTitle || 'chapters')
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .substring(0, 50);
    
    const date = new Date().toISOString().split('T')[0];
    return `${videoTitle}_${date}.${extension}`;
  }
  
  return {
    formatTimestamp,
    toYouTubeChapters,
    toMarkdown,
    toCSV,
    toJSON,
    toHTML,
    createBlob,
    downloadFile,
    copyToClipboard,
    generateFilename
  };
})();