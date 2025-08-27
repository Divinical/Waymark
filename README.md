# Waymark

A lightweight, hotkey-first Chrome/Edge extension for creating timestamped markers on any web page with video elements. Perfect for creating YouTube chapters, taking notes during videos, and exporting timestamps in multiple formats.

## ✨ Features

- **Universal Video Support**: Works on YouTube, Twitch, Vimeo, and any site with HTML5 video
- **Hotkey-First Design**: Quick marking with Alt+M, no clicking required
- **Multiple Export Formats**:
  - YouTube chapters format (with automatic 00:00 intro)
  - Markdown with deep links
  - CSV spreadsheet
  - JSON for developers
  - HTML with screenshots
- **Smart Deep Links**: Automatically generates time-stamped URLs for supported platforms
- **Optional Screenshots**: Capture visual references with each marker
- **SPA Support**: Seamlessly handles single-page navigation on YouTube and Twitch
- **Manual Timer Mode**: Falls back to manual timing for DRM-protected content
- **Local Storage**: All data stays on your device - no cloud, no login required
- **Session Management**: Auto-saves progress and allows switching between videos

## 🚀 Installation

### Load Unpacked (Development)

1. Download or clone this repository
2. Open Chrome or Edge and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `chapter-marker-buddy` folder
6. The extension icon should appear in your toolbar

## ⌨️ How to Use

### Quick Start

1. Navigate to any video page (YouTube, Twitch, Vimeo, etc.)
2. The overlay will appear in the bottom-right corner
3. Use hotkeys or click buttons to add markers:
   - **Alt+M**: Add marker at current time
   - **Alt+Shift+M**: Show/hide overlay
   - **Alt+E**: Export markers

### Adding Markers

1. **With Title**: Type a title in the input field, then press Alt+M
2. **Quick Mark**: Press Alt+M without typing to create a marker with auto-generated title
3. **With Screenshot**: Enable "Auto-screenshot each marker" checkbox before marking

### Exporting Chapters

1. Press Alt+E or click Export button
2. Choose your format:
   - **YouTube Chapters**: Copy to clipboard for video descriptions
   - **Markdown**: Copy formatted list with clickable timestamps
   - **CSV**: Download spreadsheet file
   - **JSON**: Download structured data
   - **HTML**: Download visual report with screenshots

### Managing Sessions

1. Click "More" button to see saved sessions
2. Sessions are automatically created per video per day
3. Load previous sessions or delete old ones
4. Export all data for backup

## 🎯 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Alt+M | Add marker at current timestamp |
| Alt+Shift+M | Toggle overlay visibility |
| Alt+E | Open export menu |

## 🔧 Settings

Access settings through the overlay's "More" menu:

- **Auto-screenshot**: Capture tab screenshot with each marker
- **Insert 00:00 intro**: Automatically add intro chapter when exporting
- **Overlay position**: Drag the header to reposition

## 📋 Export Formats

### YouTube Chapters
```
00:00 Introduction
02:45 Main Topic
05:30 Example Demo
08:15 Conclusion
```

### Markdown with Deep Links
```markdown
- **00:02:45** – [Main Topic](https://youtube.com/watch?v=xxx&t=165s)
- **00:05:30** – [Example Demo](https://youtube.com/watch?v=xxx&t=330s)
```

### CSV Structure
```csv
timestamp,title,seconds,source_url,created_at
00:02:45,Main Topic,165,https://youtube.com/watch?v=xxx,2024-01-15T10:30:00Z
```

## 🛡️ Privacy & Permissions

### Required Permissions

- **storage**: Save markers and settings locally
- **downloads**: Export files to your computer
- **tabs**: Capture screenshots (optional feature)
- **activeTab**: Interact with video elements

### Privacy Commitment

- ✅ All data stored locally on your device
- ✅ No external servers or API calls
- ✅ No tracking or analytics
- ✅ No login or account required
- ✅ Works completely offline

## ⚠️ Known Limitations

1. **DRM-Protected Sites**: Netflix, Disney+, Amazon Prime, etc. will use manual timer mode
2. **Cross-Origin iFrames**: Cannot access videos in iframes from different domains
3. **Fullscreen Mode**: Overlay may be hidden (hotkeys still work)
4. **Mobile Browsers**: Extension requires desktop Chrome/Edge

## 🔧 Troubleshooting

### Overlay Not Appearing

1. Refresh the page after installing
2. Check if site is in excluded list (DRM sites)
3. Click extension icon in toolbar to toggle

### Hotkeys Not Working

1. Ensure overlay is loaded (icon in toolbar)
2. Click outside any input field
3. Check for conflicts with other extensions

### Can't Read Video Time

This happens on DRM-protected content:
1. Use Manual Timer mode
2. Click Start when video begins
3. Markers will use timer instead of video time

### Reset Extension Data

1. Click "More" in overlay
2. Click "Clear All Data"
3. Or go to `chrome://extensions/` → Details → Clear Storage

## 🔄 SPA Navigation Support

The extension automatically detects navigation on single-page applications:

- **YouTube**: Saves session when switching videos
- **Twitch**: Handles VOD navigation
- **Vimeo**: Detects video changes

Previous sessions are auto-saved and can be reloaded from the "More" menu.

## 📝 Manual Timer Mode

When video time cannot be read (DRM content):

1. Manual timer appears automatically
2. Click "Start" when video begins playing
3. Use Pause/Resume as needed
4. Markers use timer time instead of video time
5. Export works normally (without deep links)

## 🚀 Advanced Features

### Batch Operations

- Export all sessions at once
- Import/export backup JSON files
- Bulk delete old sessions

### Custom Session Management

Sessions are keyed by: `{domain}|{video-id}|{date}`
- Automatically created per video
- Restored on page reload
- Separate markers for each day

### Screenshot Management

- Optional per-marker screenshots
- Included in HTML exports
- Stored as base64 data URLs
- Automatically compressed

## 🐛 Bug Reports & Feedback

Found an issue? Please report it with:
1. Browser version (Chrome/Edge)
2. Website where issue occurred
3. Steps to reproduce
4. Console errors (F12 → Console)

## 📄 License

MIT License - Free to use and modify

## 🏗️ Technical Details

- **Manifest Version**: V3
- **No Frameworks**: Plain JavaScript for instant loading
- **No Bundlers**: Direct file access
- **Storage**: chrome.storage.local API
- **Modern APIs**: ES6+, async/await

## 🎯 Acceptance Criteria Met

✅ YouTube chapter export with 00:00 intro  
✅ Markdown with working deep links  
✅ CSV/JSON download functionality  
✅ SPA navigation handling  
✅ Multi-video element support  
✅ Manual timer for DRM content  
✅ Screenshot capture (optional)  
✅ Draggable overlay  
✅ Keyboard shortcuts  
✅ Local storage only  
✅ Session management  
✅ Auto-save and restore  

---

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Compatibility**: Chrome 88+, Edge 88+
