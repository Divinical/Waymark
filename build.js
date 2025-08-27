#!/usr/bin/env node

/**
 * Build script for Waymark Chrome Extension
 * Creates a clean distribution package ready for Chrome Web Store submission
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BUILD_DIR = 'dist';
const SOURCE_FILES = [
  'manifest.json',
  'LICENSE',
  'src/',
  'icons/'
];

const EXCLUDED_FILES = [
  '.git',
  '.gitignore',
  'node_modules',
  'package.json',
  'package-lock.json',
  'build.js',
  'README.md',
  'webpack.config.js',
  'dist',
  '*.zip',
  '.DS_Store',
  'Thumbs.db',
  'store-assets'
];

console.log('🚀 Building Waymark for Chrome Web Store...\n');

// Clean previous build
if (fs.existsSync(BUILD_DIR)) {
  console.log('🧹 Cleaning previous build...');
  fs.rmSync(BUILD_DIR, { recursive: true });
}

// Create build directory
fs.mkdirSync(BUILD_DIR, { recursive: true });
console.log('📁 Created build directory');

// Copy source files
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  
  if (stat.isDirectory()) {
    // Create directory if it doesn't exist
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    // Copy all files in directory
    const files = fs.readdirSync(src);
    files.forEach(file => {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      copyRecursive(srcPath, destPath);
    });
  } else {
    // Copy file
    fs.copyFileSync(src, dest);
  }
}

// Copy each source file/directory
SOURCE_FILES.forEach(source => {
  const srcPath = path.resolve(source);
  const destPath = path.resolve(BUILD_DIR, source);
  
  if (fs.existsSync(srcPath)) {
    console.log(`📋 Copying ${source}...`);
    copyRecursive(srcPath, destPath);
  } else {
    console.log(`⚠️  Warning: ${source} not found, skipping...`);
  }
});

// Read and validate manifest
const manifestPath = path.join(BUILD_DIR, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`✅ Manifest validated: ${manifest.name} v${manifest.version}`);
    console.log(`   Description: ${manifest.description.substring(0, 60)}...`);
  } catch (error) {
    console.error('❌ Invalid manifest.json:', error.message);
    process.exit(1);
  }
} else {
  console.error('❌ manifest.json not found!');
  process.exit(1);
}

// Create build info
const buildInfo = {
  version: require('./package.json').version,
  buildDate: new Date().toISOString(),
  buildTime: Date.now()
};

fs.writeFileSync(
  path.join(BUILD_DIR, '.build-info.json'), 
  JSON.stringify(buildInfo, null, 2)
);

// Generate file list for verification
const distFiles = [];
function listFiles(dir, basePath = '') {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const relativePath = path.join(basePath, file);
    
    if (fs.statSync(filePath).isDirectory()) {
      listFiles(filePath, relativePath);
    } else {
      const stats = fs.statSync(filePath);
      distFiles.push({
        path: relativePath.replace(/\\/g, '/'),
        size: stats.size,
        modified: stats.mtime.toISOString()
      });
    }
  });
}

listFiles(BUILD_DIR);

// Display build summary
console.log('\n📊 Build Summary:');
console.log(`   📁 Files: ${distFiles.length}`);
console.log(`   📦 Size: ${(distFiles.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(1)} KB`);
console.log(`   📅 Built: ${new Date().toLocaleString()}`);

// List important files
console.log('\n📋 Package Contents:');
const importantFiles = distFiles.filter(f => 
  f.path.includes('manifest.json') || 
  f.path.includes('.js') || 
  f.path.includes('icons/') ||
  f.path.includes('.html') ||
  f.path.includes('.css')
);

importantFiles.forEach(file => {
  console.log(`   ${file.path} (${(file.size / 1024).toFixed(1)} KB)`);
});

console.log('\n✅ Build completed successfully!');
console.log(`📦 Distribution files are in: ${BUILD_DIR}/`);
console.log('\n🚀 Next steps:');
console.log('   1. Run "npm run package" to create ZIP file');
console.log('   2. Test the extension by loading dist/ folder in Chrome');
console.log('   3. Upload ZIP to Chrome Web Store');
console.log('\n💡 To test: Chrome → Extensions → Load unpacked → Select dist/ folder');