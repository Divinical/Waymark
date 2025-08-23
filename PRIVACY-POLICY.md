# Privacy Policy for Chapter Marker Buddy

**Effective Date:** January 2025  
**Last Updated:** January 2025

## Overview

Chapter Marker Buddy is a privacy-first Chrome extension that helps you create timestamped markers on web videos. We are committed to protecting your privacy and being transparent about our data practices.

## Data Collection and Storage

### What We Collect
Chapter Marker Buddy collects and stores the following data **locally on your device only**:

- **Video markers**: Timestamps, titles, and optional screenshots you create
- **Session data**: URL, video title, and creation dates for organization
- **Settings**: Your preferences for overlay position, export formats, and feature toggles
- **Usage data**: Local storage statistics for cleanup and optimization

### What We DON'T Collect
- Personal information (name, email, etc.)
- Browsing history beyond current video sessions
- Analytics or usage tracking
- User behavior data
- Device identifiers or fingerprinting data

## Data Storage

### Local Storage Only
All data is stored exclusively in your browser's local storage using Chrome's `chrome.storage.local` API. This means:

- **No cloud storage**: Your data never leaves your device
- **No external servers**: We don't operate any servers or databases
- **No data transmission**: Nothing is sent over the internet
- **User control**: You can delete all data at any time

### Storage Management
- Data is organized by video URL and date
- Automatic cleanup removes old screenshots (30+ days) and sessions (90+ days)
- Manual cleanup options available in extension settings
- Storage quota monitoring prevents excessive usage

## Permissions Explanation

### Required Permissions

**`storage`**
- **Purpose**: Save your markers, settings, and sessions locally
- **Scope**: Limited to extension data only
- **Data**: Timestamps, titles, and preferences

**`downloads`** 
- **Purpose**: Export your markers as CSV, JSON, or HTML files
- **Scope**: Only files you explicitly choose to download
- **Data**: Your created markers in requested format

**`tabs`**
- **Purpose**: Capture optional screenshots and detect video elements
- **Scope**: Only active tab when you use screenshot feature
- **Data**: Screenshot images (stored locally)

**`activeTab`**
- **Purpose**: Interact with video players and inject overlay interface  
- **Scope**: Current tab only, when extension is actively used
- **Data**: Video timing and page title for marker creation

### Host Permissions
- **`https://*/*` and `http://*/*`**: Access web pages to detect video elements
- **Excluded sites**: DRM-protected streaming services (Netflix, Disney+, etc.)

## Third-Party Services

### No Third Parties
Chapter Marker Buddy does not:
- Connect to external APIs or services
- Use third-party analytics (Google Analytics, etc.)
- Integrate with social media platforms
- Share data with advertising networks
- Include tracking pixels or beacons

## Data Security

### Protection Measures
- All data processing happens locally in your browser
- No network transmission of personal data
- Chrome extension security model provides sandboxing
- Data encrypted by Chrome's storage system

### User Control
- **View data**: All stored data visible in extension interface
- **Export data**: Download complete backup as JSON file
- **Delete data**: Clear individual sessions or all data instantly
- **Manage storage**: Monitor usage and run cleanup tools

## Children's Privacy

Chapter Marker Buddy does not knowingly collect data from children under 13. Since all processing is local and no personal information is collected, the extension is generally safe for all ages. Parents should supervise children's internet usage as appropriate.

## International Users

Since all data stays on your device, there are no international data transfers or jurisdiction concerns. The extension works the same way regardless of your location.

## Changes to This Policy

We may update this privacy policy to reflect changes in our practices or legal requirements. Updates will be posted with the extension and on our website. We encourage reviewing this policy periodically.

## Data Retention

- **Active sessions**: Kept until manually deleted or automatic cleanup
- **Screenshots**: Automatically deleted after 30 days (configurable)  
- **Old sessions**: Automatically deleted after 90 days (configurable)
- **Settings**: Retained until extension is uninstalled

## Your Rights

Since all data is stored locally, you have complete control:

- **Access**: View all stored data through extension interface
- **Portability**: Export data in standard formats (JSON, CSV)
- **Deletion**: Remove specific sessions or clear all data
- **Modification**: Edit or update any stored information

## Contact Information

For privacy-related questions or concerns:

- **GitHub**: [Repository Issues Page]
- **Email**: [Your contact email]

## Open Source Transparency

Chapter Marker Buddy is open source. You can review the complete source code to verify our privacy practices:

- **Source code**: Available on GitHub
- **No obfuscation**: All code is readable and auditable
- **Community review**: Open to security audits and contributions

---

**Summary**: We don't collect, transmit, or store any personal data on external servers. Everything stays on your device, under your control. We believe privacy is a fundamental right, not a feature.