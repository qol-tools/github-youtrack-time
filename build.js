#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Clean and create directories
const srcDir = 'src';
const distDir = 'dist';
const packagesDir = 'packages';

if (fs.existsSync(distDir)) {
	fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(packagesDir, { recursive: true });

// Files to copy to dist
const files = [
	'manifest.json',
	'background-youtrack.js',
	'background.html',
	'content.js',
	'content.css',
	'ide-opener.js',
	'popup.html',
	'popup.js',
];

// Copy files from src/
files.forEach(file => {
	const srcPath = path.join(srcDir, file);
	const distPath = path.join(distDir, file);
	if (fs.existsSync(srcPath)) {
		fs.copyFileSync(srcPath, distPath);
		console.log(`✓ Copied ${file}`);
	} else {
		console.warn(`⚠ Warning: ${file} not found in src/`);
	}
});

// Copy icons from root
['icon-48.png', 'icon-96.png'].forEach(file => {
	if (fs.existsSync(file)) {
		fs.copyFileSync(file, path.join(distDir, file));
		console.log(`✓ Copied ${file}`);
	} else {
		console.warn(`⚠ Warning: ${file} not found`);
	}
});

// Create Chrome version (MV3) in dist-chrome
const distChromeDir = 'dist-chrome';
if (fs.existsSync(distChromeDir)) {
	fs.rmSync(distChromeDir, { recursive: true });
}
fs.mkdirSync(distChromeDir, { recursive: true });

// Copy all files to Chrome dist
files.forEach(file => {
	const srcPath = path.join(srcDir, file);
	if (fs.existsSync(srcPath) && file !== 'manifest.json') {
		fs.copyFileSync(srcPath, path.join(distChromeDir, file));
	}
});

['icon-48.png', 'icon-96.png'].forEach(file => {
	if (fs.existsSync(file)) {
		fs.copyFileSync(file, path.join(distChromeDir, file));
	}
});

// Copy Chrome manifest
if (fs.existsSync(path.join(srcDir, 'manifest-chrome.json'))) {
	fs.copyFileSync(
		path.join(srcDir, 'manifest-chrome.json'),
		path.join(distChromeDir, 'manifest.json')
	);
	console.log('✓ Created Chrome version in dist-chrome/');
}

console.log('\n✓ Build complete! Firefox: dist/ | Chrome: dist-chrome/');
