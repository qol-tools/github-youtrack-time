// IDE Opener Feature - Open GitHub PR branches in JetBrains IDEs
// This is a separate feature from the YouTrack time tracking

(function() {
	'use strict';

	const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

	// Storage key for IDE settings
	const STORAGE_KEY_IDE_PROJECT_PATH = 'ide-project-path';

	// CSS class for the IDE button
	const IDE_BUTTON_CLASS = 'gh-ide-opener-button';

	/**
	 * Extracts the branch name from the PR page
	 * @returns {string|null}
	 */
	function extractBranchName() {
		// Try the head-ref link first (most reliable)
		const branchElement = document.querySelector('.head-ref a');
		if (branchElement) {
			return branchElement.textContent.trim();
		}

		// Fallback: try the span inside head-ref
		const branchSpan = document.querySelector('.head-ref span.css-truncate-target');
		if (branchSpan) {
			return branchSpan.textContent.trim();
		}

		return null;
	}

	/**
	 * Extracts the repository name from the current URL
	 * @returns {string|null}
	 */
	function extractRepoName() {
		const match = location.pathname.match(/^\/[^/]+\/([^/]+)/);
		return match ? match[1] : null;
	}

	/**
	 * Gets the stored project path for this repo, or null if not set
	 * @param {string} repoName
	 * @returns {string|null}
	 */
	function getProjectPath(repoName) {
		const stored = localStorage.getItem(STORAGE_KEY_IDE_PROJECT_PATH);
		if (!stored) return null;

		try {
			const paths = JSON.parse(stored);
			return paths[repoName] || null;
		} catch {
			return null;
		}
	}

	/**
	 * Saves the project path for a repo
	 * @param {string} repoName
	 * @param {string} path
	 */
	function saveProjectPath(repoName, path) {
		let paths = {};
		const stored = localStorage.getItem(STORAGE_KEY_IDE_PROJECT_PATH);
		if (stored) {
			try {
				paths = JSON.parse(stored);
			} catch {
				paths = {};
			}
		}
		paths[repoName] = path;
		localStorage.setItem(STORAGE_KEY_IDE_PROJECT_PATH, JSON.stringify(paths));
	}

	/**
	 * Shows a prompt to configure the project path
	 * @param {string} repoName
	 * @param {function} onSave - Callback when path is saved
	 */
	function showConfigPrompt(repoName, onSave) {
		const existingPath = getProjectPath(repoName) || '';

		const overlay = document.createElement('div');
		overlay.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.5);
			z-index: 10000;
			display: flex;
			align-items: center;
			justify-content: center;
		`;

		const modal = document.createElement('div');
		modal.style.cssText = `
			background: #ffffff;
			border-radius: 8px;
			padding: 24px;
			max-width: 500px;
			width: 90%;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		`;

		// Detect dark mode
		const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
		const match = htmlBg.match(/rgb\((\d+)/);
		const isDark = match && parseInt(match[1], 10) < 50;

		if (isDark) {
			modal.style.background = '#161b22';
			modal.style.color = '#c9d1d9';
		}

		modal.innerHTML = `
			<h3 style="margin: 0 0 16px 0; font-size: 16px;">Configure Project Path for "${repoName}"</h3>
			<p style="margin: 0 0 12px 0; font-size: 14px; color: ${isDark ? '#8b949e' : '#57606a'};">
				Enter the absolute path to this project on your local machine:
			</p>
			<input type="text" id="ide-project-path-input" value="${existingPath}"
				placeholder="/Users/you/projects/${repoName}"
				style="
					width: 100%;
					padding: 8px 12px;
					border: 1px solid ${isDark ? '#30363d' : '#d1d5da'};
					border-radius: 6px;
					font-size: 14px;
					background: ${isDark ? '#0d1117' : '#ffffff'};
					color: ${isDark ? '#c9d1d9' : '#24292e'};
					box-sizing: border-box;
					margin-bottom: 16px;
				"
			/>
			<div style="display: flex; gap: 8px; justify-content: flex-end;">
				<button id="ide-config-cancel" style="
					padding: 8px 16px;
					border: 1px solid ${isDark ? '#30363d' : '#d1d5da'};
					border-radius: 6px;
					background: transparent;
					color: ${isDark ? '#c9d1d9' : '#24292e'};
					cursor: pointer;
					font-size: 14px;
				">Cancel</button>
				<button id="ide-config-save" style="
					padding: 8px 16px;
					border: none;
					border-radius: 6px;
					background: #2da44e;
					color: white;
					cursor: pointer;
					font-size: 14px;
				">Save</button>
			</div>
		`;

		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		const input = modal.querySelector('#ide-project-path-input');
		const saveBtn = modal.querySelector('#ide-config-save');
		const cancelBtn = modal.querySelector('#ide-config-cancel');

		input.focus();
		input.select();

		const close = () => overlay.remove();

		cancelBtn.addEventListener('click', close);
		overlay.addEventListener('click', (e) => {
			if (e.target === overlay) close();
		});

		const save = () => {
			const path = input.value.trim();
			if (path) {
				saveProjectPath(repoName, path);
				close();
				onSave(path);
			}
		};

		saveBtn.addEventListener('click', save);
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') save();
			if (e.key === 'Escape') close();
		});
	}

	/**
	 * Opens the project in IntelliJ IDEA via qol-tray daemon (through background script)
	 * Falls back to idea:// protocol if daemon is not available
	 * @param {string} projectPath - Absolute path to the project
	 * @param {string} branchName - Branch name to checkout
	 */
	async function openInIDE(projectPath, branchName) {
		// Try the qol-tray daemon via background script (avoids CORS issues)
		try {
			const result = await browserAPI.runtime.sendMessage({
				action: 'ide.checkout',
				projectPath,
				branch: branchName
			});

			if (result && result.ok) {
				showNotification(`Checked out "${branchName}" and opened IDE`);
				return;
			} else {
				console.log('IDE checkout via daemon failed:', result?.error);
				// Fall through to fallback
			}
		} catch (err) {
			console.log('Background script error:', err);
			// Fall through to fallback
		}

		// Fallback: use idea:// protocol and copy branch to clipboard
		console.log('Falling back to idea:// protocol');

		const readmePath = `${projectPath}/README.md`;
		const ideUrl = `idea://open?file=${encodeURIComponent(readmePath)}`;

		// Copy branch name to clipboard for manual checkout
		if (branchName) {
			navigator.clipboard.writeText(branchName).then(() => {
				showNotification(`Branch "${branchName}" copied (daemon offline)`);
			}).catch(() => {
				showNotification(`Branch: ${branchName} (copy manually)`);
			});
		}

		window.location.href = ideUrl;
	}

	/**
	 * Shows a notification toast
	 * @param {string} message
	 */
	function showNotification(message) {
		const notification = document.createElement('div');
		notification.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			padding: 12px 16px;
			background-color: #d29922;
			color: white;
			border-radius: 6px;
			z-index: 10001;
			font-size: 14px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		`;
		notification.textContent = message;
		document.body.appendChild(notification);
		setTimeout(() => notification.remove(), 4000);
	}

	/**
	 * Checks if current page is a PR page
	 * @returns {boolean}
	 */
	function isPRPage() {
		return /\/pull\/\d+/.test(location.href);
	}

	/**
	 * Adds the "Open in IDE" button to the PR header
	 */
	function addIDEButton() {
		if (!isPRPage()) return;

		const header = document.querySelector('.gh-header-actions');
		if (!header) return;

		// Don't add if already exists
		if (header.querySelector(`.${IDE_BUTTON_CLASS}`)) return;

		const repoName = extractRepoName();
		if (!repoName) return;

		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = `${IDE_BUTTON_CLASS} btn btn-sm d-none d-md-block`;
		btn.title = 'Open in IntelliJ IDEA (click to open, right-click to configure)';
		btn.style.marginRight = '8px';

		// Create SVG icon (code brackets)
		btn.innerHTML = `
			<svg class="octicon" viewBox="0 0 16 16" width="16" height="16" style="margin-right: 4px; vertical-align: text-top;">
				<path fill="currentColor" d="M4.72 3.22a.75.75 0 0 1 1.06 1.06L2.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25zm6.56 0a.75.75 0 1 0-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06l4.25-4.25a.75.75 0 0 0 0-1.06l-4.25-4.25z"/>
			</svg>
			Open in IDE
		`;

		// Left click: open in IDE
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			const projectPath = getProjectPath(repoName);
			const branchName = extractBranchName();

			if (!projectPath) {
				showConfigPrompt(repoName, (path) => {
					openInIDE(path, branchName);
				});
			} else {
				openInIDE(projectPath, branchName);
			}
		});

		// Right click: configure path
		btn.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			showConfigPrompt(repoName, () => {
				showNotification('Project path saved!');
			});
		});

		header.prepend(btn);
	}

	/**
	 * Initialize the IDE opener feature
	 */
	function init() {
		// Try to add button immediately
		addIDEButton();

		// Listen for GitHub's navigation events
		document.addEventListener('turbo:load', addIDEButton);
		document.addEventListener('turbo:render', addIDEButton);
		document.addEventListener('pjax:end', addIDEButton);

		// Watch for DOM changes
		let lastUrl = location.href;
		const observer = new MutationObserver(() => {
			if (location.href !== lastUrl) {
				lastUrl = location.href;
				addIDEButton();
			}
		});
		observer.observe(document, { subtree: true, childList: true });
	}

	// Start when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
