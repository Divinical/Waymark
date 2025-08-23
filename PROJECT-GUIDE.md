# Chapter Marker Buddy - Project Guide

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Status**: Production Ready / Chrome Web Store Submitted

This comprehensive guide contains everything you need to know to maintain, upgrade, and enhance the Chapter Marker Buddy Chrome extension.

## 📁 Project Structure

```
chapter-marker/
├── src/
│   ├── service_worker.js          # Background script (Manifest V3)
│   └── content/
│       ├── content.js             # Main content script & UI controller
│       ├── storage.js             # Chrome storage management
│       ├── exporters.js           # Export formats (YouTube, CSV, JSON, HTML)
│       ├── utils.js               # Utility functions & video detection
│       ├── deeplinks.js           # Platform-specific timestamp URLs
│       ├── screenshot-db.js       # IndexedDB for screenshot storage
│       ├── title-generator.js     # Smart title generation
│       ├── overlay.html           # Extension UI template
│       └── overlay.css            # Extension styling
├── icons/                         # Extension icons (16px, 48px, 128px)
├── manifest.json                  # Extension configuration
├── build.js                       # Distribution build script
├── package.json                   # Node.js dependencies & scripts
├── dist/                         # Built distribution (auto-generated)
├── store-assets/                 # Chrome Web Store submission assets
├── PRIVACY-POLICY.md             # Required privacy policy
├── SUBMISSION-GUIDE.md           # Chrome Web Store submission guide
└── PROJECT-GUIDE.md              # This file
```

## 🏗️ Architecture Overview

### Core Components

1. **Service Worker** (`service_worker.js`)
   - Handles Chrome extension commands (Alt+M, Alt+Shift+M, Alt+E)
   - Manages screenshot capture via Chrome tabs API
   - Coordinates downloads and file operations

2. **Content Script** (`content.js`)
   - Main UI controller and event handler
   - Video detection and time tracking
   - Session management and data persistence
   - Overlay rendering and user interactions

3. **Storage System** (`storage.js`)
   - Chrome local storage wrapper with quota management
   - Session-based data organization
   - Progressive cleanup for old data
   - Export/import functionality

4. **Export Engine** (`exporters.js`)
   - YouTube chapters format with auto 00:00 intro
   - Markdown with clickable deep links
   - CSV for spreadsheet analysis
   - JSON for API/automation use
   - HTML with embedded screenshots

### Key Features

- **Universal Video Support**: YouTube, Twitch, Vimeo, any HTML5 video
- **Hotkey-First Design**: Alt+M (mark), Alt+Shift+M (toggle), Alt+E (export)
- **Smart Deep Links**: Platform-specific timestamp URLs
- **Screenshot Integration**: Optional visual markers via IndexedDB
- **Session Management**: Auto-save per video per day
- **Privacy-First**: 100% local storage, no external APIs
- **SPA Navigation**: Handles YouTube/Twitch page changes seamlessly

## 🔄 Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Load extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select project root directory

# Test on various video sites
# - YouTube: https://youtube.com/watch?v=dQw4w9WgXcQ
# - Twitch: https://twitch.tv/videos/123456
# - Vimeo: https://vimeo.com/123456
```

### Build & Distribution

```bash
# Create distribution package
npm run build       # Build dist/ folder
npm run validate    # Verify package integrity
npm run package     # Build + create ZIP for store
npm run clean       # Remove build artifacts
```

### Version Updates

1. **Update Version Numbers**:
   ```bash
   # Update version in both files:
   # - manifest.json: "version": "1.1.0"
   # - package.json: "version": "1.1.0"
   ```

2. **Test Thoroughly**:
   - Load unpacked extension in fresh Chrome profile
   - Test all major features (mark, export, session management)
   - Verify on YouTube, Twitch, Vimeo
   - Check permissions still work correctly

3. **Build & Submit**:
   ```bash
   npm run package  # Creates new ZIP with updated version
   # Upload to Chrome Web Store Developer Dashboard
   ```

## 🚀 Feature Enhancement Guide

### Adding New Export Formats

1. **Add to `exporters.js`**:
   ```javascript
   function toNewFormat(session) {
     // Implementation here
     return formattedContent;
   }
   
   // Add to return object
   return {
     // ... existing functions
     toNewFormat
   };
   ```

2. **Update UI in `content.js`**:
   - Add button to export panel
   - Add case to `exportFormat()` function

3. **Test export functionality**

### Supporting New Video Platforms

1. **Add URL detection in `utils.js`**:
   ```javascript
   function extractVideoId(url) {
     // Add new platform detection
     if (hostname.includes('newplatform.com')) {
       // Extract video ID logic
       return `newplatform-${videoId}`;
     }
   }
   ```

2. **Add deep link support in `deeplinks.js`**:
   ```javascript
   function buildDeepLink(url, seconds) {
     if (url.includes('newplatform.com')) {
       return `${url}&t=${seconds}s`;
     }
   }
   ```

3. **Update `manifest.json` if needed**:
   - Add to `matches` array if platform-specific
   - Or rely on `"*://*/*"` for universal support

### Adding New UI Features

1. **Update `overlay.html`** - Add HTML elements
2. **Style in `overlay.css`** - Add CSS rules
3. **Wire up in `content.js`** - Add event listeners
4. **Handle data in `storage.js`** - Persist settings if needed

## 🔧 Common Maintenance Tasks

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update specific package
npm install archiver@latest

# Update all dependencies
npm update
```

### Security Updates

1. **Review permissions** in `manifest.json`
2. **Audit dependencies**: `npm audit`
3. **Check Chrome extension policies** for changes
4. **Review privacy policy** if data handling changes

### Performance Optimization

1. **Monitor storage usage** - Check `getStorageStats()` output
2. **Optimize screenshot compression** - Adjust quality settings
3. **Review cleanup intervals** - Tune automatic cleanup timing
4. **Profile content script performance** - Use Chrome DevTools

## 🐛 Troubleshooting Guide

### Common Issues

**Extension not loading:**
- Check manifest.json syntax with JSON validator
- Verify all file paths in manifest exist
- Check Chrome extension console for errors

**Hotkeys not working:**
- Verify extension has activeTab permission
- Check for conflicts with other extensions
- Ensure content script is injected properly

**Video detection failing:**
- Check if site uses custom video players
- Verify video element selection logic in `utils.js`
- Test with different video states (playing, paused, loading)

**Storage issues:**
- Monitor quota usage in extension popup
- Check for storage permission
- Verify Chrome storage API availability

### Debug Tools

1. **Extension Console**: `chrome://extensions/` → Details → Inspect views
2. **Content Script**: F12 → Console on video page
3. **Storage Inspector**: Chrome DevTools → Application → Storage
4. **Network Tab**: Monitor for unexpected requests

## 📊 Analytics & Monitoring

### User Feedback Tracking

Monitor Chrome Web Store reviews for:
- Feature requests
- Bug reports
- Platform compatibility issues
- UI/UX feedback

### Performance Metrics

Track via extension console:
- Storage usage trends
- Export format popularity
- Session creation patterns
- Error rates by platform

### Update Success Metrics

- Update adoption rate
- Post-update crash reports
- User retention after updates

## 🔒 Security Considerations

### Regular Security Reviews

1. **Permission Audit**: Ensure only necessary permissions
2. **Input Validation**: Review user input handling
3. **XSS Prevention**: Verify HTML output escaping
4. **Storage Security**: Check for data leakage

### Chrome Extension Security Model

- Content Security Policy automatically enforced
- Cross-origin requests restricted
- No eval() or inline scripts allowed
- All resources must be web_accessible_resources if needed

## 📝 Chrome Web Store Management

### Store Listing Updates

1. **Screenshots**: Update if UI changes significantly
2. **Description**: Keep feature list current
3. **Keywords**: Optimize based on user search terms
4. **Privacy Policy**: Update if data handling changes

### Review Response Strategy

- Respond to reviews professionally
- Address bugs mentioned in reviews
- Thank users for positive feedback
- Provide helpful solutions for issues

## 🎯 Roadmap & Ideas

### Potential Enhancements

**Short-term (v1.1-1.2)**:
- [ ] Keyboard shortcut customization
- [ ] Dark/light theme toggle
- [ ] Export template customization
- [ ] Batch marker editing

**Medium-term (v1.3-1.5)**:
- [ ] Cloud backup integration (optional)
- [ ] Collaborative marker sharing
- [ ] Advanced screenshot annotations
- [ ] Video thumbnail generation

**Long-term (v2.0+)**:
- [ ] Mobile browser support
- [ ] AI-powered marker suggestions
- [ ] Integration with video editing tools
- [ ] Multi-language support

### Platform Expansion

- Edge Add-ons store submission
- Firefox extension port (WebExtensions)
- Safari extension consideration

## 📚 Resources & References

### Documentation
- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Web Store Policies](https://developer.chrome.com/docs/webstore/program_policies/)

### Development Tools
- [Extension Reload](https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid) - Auto-reload during development
- [Chrome Extension Developer Tools](https://chrome.google.com/webstore/detail/chrome-extension-developer/fpkplegbeeofhbpacdllgkaokcknihd) - Debug extension popup

### Community
- [Chrome Extensions Google Group](https://groups.google.com/a/chromium.org/forum/#!forum/chromium-extensions)
- [Stack Overflow - Chrome Extensions](https://stackoverflow.com/questions/tagged/google-chrome-extension)

---

## 🚨 Important Notes

### Before Making Changes
1. **Always test in fresh Chrome profile**
2. **Backup current working version**
3. **Review Chrome extension policy updates**
4. **Test on all supported platforms**
5. **Update privacy policy if needed**

### Version Control Best Practices
- Tag releases: `git tag -a v1.1.0 -m "Version 1.1.0"`
- Keep changelog updated
- Commit built files separately from source
- Use semantic versioning (MAJOR.MINOR.PATCH)

### Submission Checklist
- [ ] Version numbers updated in manifest.json and package.json
- [ ] Extension tested thoroughly in fresh Chrome profile
- [ ] Build created with `npm run package`
- [ ] Privacy policy reviewed and updated if needed
- [ ] Store listing updated with new features
- [ ] Screenshots updated if UI changed

**Remember**: Chrome Web Store reviews can take 3-7 business days. Plan releases accordingly and always test thoroughly before submission.

This guide should provide everything you need to successfully maintain and enhance Chapter Marker Buddy. Keep this file updated as you make changes to the project!