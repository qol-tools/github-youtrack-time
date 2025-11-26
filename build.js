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

console.log('\n✓ Build complete! Extension files are in dist/');
