// GitHub YouTrack Time Tracker - Standalone Extension

// Storage keys
const STORAGE_KEY_SUBDOMAIN = 'yt-subdomain';
const STORAGE_KEY_WORK_ITEM_TYPE = 'yt-work-item-type';
const STORAGE_KEY_TOKEN = 'yt-token';

// UI Constants
const COLORS = {
	LIGHT: {
		bg: '#ffffff',
		bgSecondary: '#f6f8fa',
		border: '#d1d5da',
		text: '#24292e',
		textSecondary: '#57606a',
		buttonBg: '#2da44e',
		buttonDisabled: '#e5e7eb',
		errorBg: '#ffeef0',
		errorText: '#d1242f',
	},
	DARK: {
		bg: '#0d1117',
		bgSecondary: '#161b22',
		border: '#30363d',
		text: '#c9d1d9',
		textSecondary: '#8b949e',
		buttonBg: '#238636',
		buttonDisabled: '#21262d',
		errorBg: '#422426',
		errorText: '#ff7b72',
	}
};

// Timing constants
const THROTTLE_DELAY_MS = 100;
const POLL_INTERVAL_MS = 500;
const POLL_MAX_ATTEMPTS = 20;

// Regex patterns
const YOUTRACK_ID_PATTERN = /[A-Z]+-\d+/;
const PR_PAGE_PATTERN = /\/pull\/\d+/;
const DARK_MODE_RGB_THRESHOLD = 50;

// API Functions

/**
 * @param {string} subdomain - YouTrack subdomain
 * @param {string} token - YouTrack API token
 * @returns {Promise<{ok: boolean, data?: any, error?: string}>}
 */
async function fetchWorkItemTypes(subdomain, token) {
	if (!subdomain || typeof subdomain !== 'string') {
		return { ok: false, error: 'Invalid subdomain' };
	}
	if (!token || typeof token !== 'string') {
		return { ok: false, error: 'Invalid token' };
	}

	try {
		return await chrome.runtime.sendMessage({
			action: 'ytbridge.request',
			subdomain,
			url: `https://${subdomain}.youtrack.cloud/api/admin/timeTrackingSettings/workItemTypes?fields=id,name`,
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Accept': 'application/json',
			},
		});
	} catch (error) {
		return { ok: false, error: error?.message || 'Request failed' };
	}
}

/**
 * @param {string} subdomain - YouTrack subdomain
 * @param {string} issueId - Issue ID to fetch details for
 * @param {string} token - YouTrack API token
 * @returns {Promise<{ok: boolean, data?: any, error?: string}>}
 */
async function fetchIssueDetails(subdomain, issueId, token) {
	if (!subdomain || !issueId || !token) {
		return { ok: false, error: 'Missing required parameters' };
	}

	try {
		return await chrome.runtime.sendMessage({
			action: 'ytbridge.request',
			subdomain,
			url: `https://${subdomain}.youtrack.cloud/api/issues/${issueId}?fields=idReadable,summary,customFields(name,value(name))`,
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Accept': 'application/json',
			},
		});
	} catch (error) {
		return { ok: false, error: error.message || 'Request failed' };
	}
}

/**
 * @param {string} subdomain - YouTrack subdomain
 * @param {string} issueId - Issue ID to fetch links for
 * @param {string} token - YouTrack API token
 * @returns {Promise<{ok: boolean, data?: any, error?: string}>}
 */
async function fetchIssueLinks(subdomain, issueId, token) {
	if (!subdomain || !issueId || !token) {
		return { ok: false, error: 'Missing required parameters' };
	}

	try {
		const linkQuery = (
			'id,direction(),linkType(id,directed,aggregation,sourceToTarget,targetToSource,'
			+ 'localizedSourceToTarget,localizedTargetToSource),issuesSize,trimmedIssues('
			+ 'reporter(issueRelatedGroup(@permittedGroups),id,ringId,login,name,email,isEmailVerified,guest,'
			+ 'fullName,avatarUrl,online,banned,banBadge,canReadProfile,isLocked,userType(id)),resolved,'
			+ 'fields(value(id,minutes,presentation,isEstimation,isSpentTime,name,description,localizedName,'
			+ 'isResolved,color(id,background,foreground),buildIntegration,buildLink,text,issueRelatedGroup(@permittedGroups),'
			+ 'ringId,login,email,isEmailVerified,guest,fullName,avatarUrl,online,banned,banBadge,canReadProfile,isLocked,'
			+ 'userType(id),allUsersGroup,icon,teamForProject(name,shortName)),id,$type,hasStateMachine,isUpdatable,'
			+ 'projectCustomField($type,id,field(id,name,ordinal,aliases,localizedName,fieldType(id,presentation,isBundleType,'
			+ 'valueType,isMultiValue)),bundle(id,$type),canBeEmpty,emptyFieldText,hasRunningJob,ordinal,isSpentTime,'
			+ 'isEstimation,isPublic),searchResults(id,textSearchResult(highlightRanges(@textRange),textRange(@textRange))),pausedTime),'
			+ 'project(id,ringId,name,shortName,iconUrl,template,pinned,archived,isDemo,hasArticles,team(@permittedGroups),'
			+ 'fieldsSorted,restricted,plugins(timeTrackingSettings(id,enabled),helpDeskSettings(id,enabled,defaultForm(uuid,title)),'
			+ 'vcsIntegrationSettings(hasVcsIntegrations),grazie(disabled))),visibility($type,implicitPermittedUsers(@permittedUsers),'
			+ 'permittedGroups(@permittedGroups),permittedUsers(@permittedUsers)),watchers(hasStar),id,idReadable,summary);'
			+ '@permittedUsers:id,ringId,login,name,email,isEmailVerified,guest,fullName,avatarUrl,online,banned,banBadge,'
			+ 'canReadProfile,isLocked,userType(id);@permittedGroups:id,name,ringId,allUsersGroup,icon,teamForProject(name,shortName);'
			+ '@textRange:startOffset,endOffset'
		);
		return await chrome.runtime.sendMessage({
			action: 'ytbridge.request',
			subdomain,
			url: `https://${subdomain}.youtrack.cloud/api/issues/${issueId}/links?fields=${encodeURIComponent(linkQuery)}&topLinks=25`,
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Accept': 'application/json',
			},
		});
	} catch (error) {
		return { ok: false, error: error.message || 'Request failed' };
	}
}

/**
 * @param {string} subdomain - YouTrack subdomain
 * @param {string} issueId - Issue ID to add time to
 * @param {Object} request - Time tracking request object
 * @param {string} token - YouTrack API token
 * @returns {Promise<{ok: boolean, data?: any, error?: string}>}
 */
async function addSpentTime(subdomain, issueId, request, token) {
	if (!subdomain || !issueId || !request || !token) {
		return { ok: false, error: 'Missing required parameters' };
	}

	try {
		return await chrome.runtime.sendMessage({
			action: 'ytbridge.request',
			subdomain,
			url: `https://${subdomain}.youtrack.cloud/api/issues/${issueId}/timeTracking/workItems`,
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Accept': 'application/json',
				'Content-Type': 'application/json',
			},
			body: request,
		});
	} catch (error) {
		return { ok: false, error: error.message || 'Request failed' };
	}
}

/**
 * Extracts YouTrack issue ID from GitHub PR title
 * @returns {string|null} YouTrack issue ID or null if not found
 */
function extractYouTrackId() {
	// Try new GitHub UI first (2024+), then fall back to old selectors
	const titleEl = document.querySelector('.markdown-title') ||
		document.querySelector('.gh-header-title .js-issue-title');
	if (!titleEl || !titleEl.textContent) {
		return null;
	}

	const match = titleEl.textContent.match(YOUTRACK_ID_PATTERN);
	return match?.[0] ?? null;
}

/**
 * Parses time string to minutes
 * @param {string} timeStr - Time string (e.g., "30m", "2h", "0.5d")
 * @returns {number} Time in minutes
 * @throws {Error} If format is invalid
 */
function parseTimeToMinutes(timeStr) {
	if (!timeStr || typeof timeStr !== 'string') {
		throw new Error('Invalid time format. Use: 5m, 1h, 1d, etc.');
	}

	const match = timeStr.trim().match(/^(\d+(?:\.\d+)?)\s*([mhd])?$/i);
	if (!match) {
		throw new Error('Invalid time format. Use: 5m, 1h, 1d, etc.');
	}

	const value = parseFloat(match[1]);
	if (isNaN(value) || value <= 0) {
		throw new Error('Time value must be a positive number');
	}

	const unit = (match[2] || 'm').toLowerCase();
	const MINUTES_PER_HOUR = 60;
	const HOURS_PER_DAY = 8;

	switch (unit) {
		case 'm':
			return Math.round(value);
		case 'h':
			return Math.round(value * MINUTES_PER_HOUR);
		case 'd':
			return Math.round(value * MINUTES_PER_HOUR * HOURS_PER_DAY);
		default:
			throw new Error('Invalid time unit. Use: m (minutes), h (hours), d (days)');
	}
}

/**
 * Detects if GitHub is in dark mode
 * @returns {boolean} True if dark mode is active
 */
function isDarkMode() {
	const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
	const match = htmlBg.match(/rgb\((\d+)/);
	if (!match) {
		return false;
	}

	const redValue = parseInt(match[1], 10);
	return !isNaN(redValue) && redValue < DARK_MODE_RGB_THRESHOLD;
}

/**
 * Gets theme colors based on current mode
 * @returns {Object} Theme color object
 */
function getTheme() {
	return isDarkMode() ? COLORS.DARK : COLORS.LIGHT;
}

/**
 * Creates a DOM element with props and children
 * @param {string} tag - HTML tag name
 * @param {Object} props - Element properties
 * @param {...(string|HTMLElement)} children - Child elements or text
 * @returns {HTMLElement}
 */
function createElement(tag, props, ...children) {
	const el = document.createElement(tag);
	if (props) {
		Object.entries(props).forEach(([key, value]) => {
			if (key === 'style' && typeof value === 'object') {
				Object.assign(el.style, value);
			} else if (key === 'className') {
				el.className = value;
			} else if (key.startsWith('on')) {
				el.addEventListener(key.substring(2).toLowerCase(), value);
			} else {
				el.setAttribute(key, value);
			}
		});
	}
	children.forEach(child => {
		if (typeof child === 'string') {
			el.appendChild(document.createTextNode(child));
		} else if (child) {
			el.appendChild(child);
		}
	});
	return el;
}

function createModal(issueId) {
	const existingModal = document.querySelector('.yt-time-modal');
	if (existingModal) {
		existingModal.remove();
	}

	const savedSubdomain = localStorage.getItem(STORAGE_KEY_SUBDOMAIN);
	const savedWorkItemType = localStorage.getItem(STORAGE_KEY_WORK_ITEM_TYPE);
	const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);

	let workItemTypes = [];
	let subtasks = [];
	let isSubdomainSaved = !!savedSubdomain;
	let isTokenSaved = !!savedToken;
	let isWorkItemTypeSaved = !!savedWorkItemType;
	let hasSubtasks = false;
	let isStoryType = false;
	let issueType = null;

	const theme = getTheme();

	const overlay = createElement('div', {
		className: 'yt-time-modal',
		style: {
			position: 'fixed',
			top: '0',
			left: '0',
			right: '0',
			bottom: '0',
			backgroundColor: isDarkMode() ? 'rgba(1, 4, 9, 0.8)' : 'rgba(0, 0, 0, 0.7)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: '9999',
		}
	});

	const modalContent = createElement('div', {
		className: 'yt-time-modal-content',
		style: {
			backgroundColor: theme.bg,
			border: `1px solid ${theme.border}`,
			borderRadius: '6px',
			padding: '24px',
			width: '400px',
			boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
			color: theme.text,
			boxSizing: 'border-box',
		}
	});

	// Apply box-sizing to all elements
	const style = createElement('style');
	style.textContent = '.yt-time-modal-content *, .yt-time-modal-content *::before, .yt-time-modal-content *::after { box-sizing: border-box; }';
	modalContent.appendChild(style);

	// Title
	const title = createElement('h2', {
		style: { margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }
	}, `Add Spent Time to ${issueId}`);
	modalContent.appendChild(title);

	// Subdomain Input
	const subdomainInputDiv = createElement('div', {
		className: 'yt-subdomain-input',
		style: { marginBottom: '16px', display: !isSubdomainSaved ? 'block' : 'none', minHeight: '76px' }
	});
	const subdomainLabel = createElement('label', {
		htmlFor: 'yt-subdomain',
		style: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }
	}, 'YouTrack Organization');
	const subdomainInputWrapper = createElement('div', { style: { display: 'flex', gap: '4px', alignItems: 'center', flex: '1', minWidth: '0' } });
	const subdomainInput = createElement('input', {
		id: 'yt-subdomain',
		type: 'text',
		placeholder: 'mycompany',
		value: savedSubdomain || '',
		style: {
			flex: '1',
			minWidth: '0',
			padding: '8px 12px',
			fontSize: '14px',
			border: `1px solid ${theme.border}`,
			borderRadius: '6px',
			backgroundColor: theme.bgSecondary,
			color: theme.text,
		}
	});
	const subdomainSuffix = createElement('span', {
		style: { fontSize: '14px', color: theme.textSecondary, whiteSpace: 'nowrap', flexShrink: '0' }
	}, '.youtrack.cloud');
	subdomainInputWrapper.appendChild(subdomainInput);
	subdomainInputWrapper.appendChild(subdomainSuffix);

	const subdomainInputGroup = createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } });
	const saveSubdomainBtn = createElement('button', {
		type: 'button',
		className: 'yt-save-subdomain',
		style: {
			padding: '8px 16px',
			fontSize: '14px',
			border: `1px solid ${theme.border}`,
			borderRadius: '6px',
			backgroundColor: theme.buttonBg,
			color: '#ffffff',
			cursor: 'pointer',
			whiteSpace: 'nowrap',
			flexShrink: '0',
		}
	}, 'Save');
	subdomainInputGroup.appendChild(subdomainInputWrapper);
	subdomainInputGroup.appendChild(saveSubdomainBtn);
	subdomainInputDiv.appendChild(subdomainLabel);
	subdomainInputDiv.appendChild(subdomainInputGroup);
	const subdomainHint = createElement('small', {
		style: { display: 'block', marginTop: '4px', fontSize: '12px', color: theme.textSecondary }
	}, 'Enter the subdomain from your YouTrack URL');
	subdomainInputDiv.appendChild(subdomainHint);
	modalContent.appendChild(subdomainInputDiv);

	// Subdomain Display
	const subdomainDisplayDiv = createElement('div', {
		className: 'yt-subdomain-display',
		style: { marginBottom: '16px', display: isSubdomainSaved ? 'flex' : 'none', alignItems: 'center', gap: '8px', minHeight: '38px' }
	});
	const subdomainDisplayLabel = createElement('label', {
		style: { flex: '1', fontSize: '14px', color: theme.textSecondary }
	});
	subdomainDisplayLabel.innerHTML = `Organization: <strong style="color: ${theme.text}">${savedSubdomain || ''}</strong>.youtrack.cloud`;
	const editSubdomainBtn = createElement('button', {
		type: 'button',
		className: 'yt-edit-subdomain',
		style: {
			padding: '4px 8px',
			border: `1px solid ${theme.border}`,
			borderRadius: '6px',
			backgroundColor: theme.bgSecondary,
			color: theme.text,
			cursor: 'pointer',
		}
	}, '✏️');
	subdomainDisplayDiv.appendChild(subdomainDisplayLabel);
	subdomainDisplayDiv.appendChild(editSubdomainBtn);
	modalContent.appendChild(subdomainDisplayDiv);

	// Token Input
	const tokenInputDiv = createElement('div', {
		className: 'yt-token-input',
		style: { marginBottom: '16px', display: isSubdomainSaved && !isTokenSaved ? 'block' : 'none', minHeight: '76px' }
	});
	const tokenLabel = createElement('label', {
		htmlFor: 'yt-token',
		style: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }
	}, 'YouTrack Token');
	const tokenInputGroup = createElement('div', { style: { display: 'flex', gap: '8px' } });
	const tokenInput = createElement('input', {
		id: 'yt-token',
		type: 'password',
		placeholder: 'Paste token from YouTrack',
		value: '',
		style: {
			flex: '1',
			padding: '8px 12px',
			fontSize: '14px',
			border: `1px solid ${theme.border}`,
			borderRadius: '6px',
			backgroundColor: theme.bgSecondary,
			color: theme.text,
			fontFamily: 'monospace',
		}
	});
	const saveTokenBtn = createElement('button', {
		type: 'button',
		className: 'yt-save-token',
		style: {
			padding: '8px 16px',
			fontSize: '14px',
			border: `1px solid ${theme.border}`,
			borderRadius: '6px',
			backgroundColor: theme.buttonBg,
			color: '#ffffff',
			cursor: 'pointer',
			whiteSpace: 'nowrap',
		}
	}, 'Save');
	tokenInputGroup.appendChild(tokenInput);
	tokenInputGroup.appendChild(saveTokenBtn);
	tokenInputDiv.appendChild(tokenLabel);
	tokenInputDiv.appendChild(tokenInputGroup);
	const tokenHint = createElement('small', {
		style: { display: 'block', marginTop: '4px', fontSize: '12px', color: theme.textSecondary }
	}, 'Get permanent token: Profile → Authentication → New token... → Paste here');
	tokenInputDiv.appendChild(tokenHint);
	modalContent.appendChild(tokenInputDiv);

	// Token Display
	const tokenDisplayDiv = createElement('div', {
		className: 'yt-token-display',
		style: { marginBottom: '16px', display: isTokenSaved ? 'flex' : 'none', alignItems: 'center', gap: '8px', minHeight: '38px' }
	});
	const tokenDisplayLabel = createElement('label', {
		style: { flex: '1', fontSize: '14px', color: theme.textSecondary }
	});
	tokenDisplayLabel.innerHTML = 'Token: <span style="font-family: monospace">••••••••</span>';
	const editTokenBtn = createElement('button', {
		type: 'button',
		className: 'yt-edit-token',
		style: {
			padding: '4px 8px',
			border: `1px solid ${theme.border}`,
			borderRadius: '6px',
			backgroundColor: theme.bgSecondary,
			color: theme.text,
			cursor: 'pointer',
		}
	}, '✏️');
	tokenDisplayDiv.appendChild(tokenDisplayLabel);
	tokenDisplayDiv.appendChild(editTokenBtn);
	modalContent.appendChild(tokenDisplayDiv);

	// Work Item Type Select
	const workTypeDiv = createElement('div', {
		className: 'yt-work-type-container',
		style: { marginBottom: '16px', display: isSubdomainSaved && isTokenSaved && !isWorkItemTypeSaved ? 'block' : 'none', minHeight: '62px' }
	});
	const workTypeLabel = createElement('label', {
		htmlFor: 'yt-work-type',
		style: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }
	}, 'Work Item Type');
	const workTypeGroup = createElement('div', { style: { display: 'flex', gap: '8px' } });
	const workTypeSelect = createElement('select', {
		id: 'yt-work-type',
		size: 1,
		style: {
			flex: '1',
			height: '38px',
			padding: '8px 12px',
			fontSize: '14px',
			border: `1px solid ${theme.border}`,
			borderRadius: '6px',
			backgroundColor: theme.bgSecondary,
			color: theme.text,
			cursor: 'pointer',
		}
	});
	workTypeSelect.innerHTML = '<option value="">Loading...</option>';
	const saveWorkTypeBtn = createElement('button', {
		type: 'button',
		className: 'yt-save-work-type',
		style: {
			padding: '8px 16px',
			fontSize: '14px',
			border: 'none',
			borderRadius: '6px',
			backgroundColor: theme.buttonBg,
			color: '#ffffff',
			cursor: 'pointer',
			whiteSpace: 'nowrap',
		}
	}, 'Save');
	workTypeGroup.appendChild(workTypeSelect);
	workTypeGroup.appendChild(saveWorkTypeBtn);
	workTypeDiv.appendChild(workTypeLabel);
	workTypeDiv.appendChild(workTypeGroup);
	modalContent.appendChild(workTypeDiv);

	// Work Item Type Display
	const workTypeDisplayDiv = createElement('div', {
		className: 'yt-work-type-display',
		style: { marginBottom: '16px', display: isWorkItemTypeSaved ? 'flex' : 'none', alignItems: 'center', gap: '8px', minHeight: '38px' }
	});
	const workTypeDisplayLabel = createElement('label', {
		style: { flex: '1', fontSize: '14px', color: theme.textSecondary }
	});
	const savedTypeObj = savedWorkItemType ? JSON.parse(savedWorkItemType) : null;
	workTypeDisplayLabel.innerHTML = `Work Item Type: <span class="yt-work-type-value">${savedTypeObj ? savedTypeObj.name : ''}</span>`;
	const editWorkTypeBtn = createElement('button', {
		type: 'button',
		className: 'yt-edit-work-type',
		style: {
			padding: '4px 8px',
			border: `1px solid ${theme.border}`,
			borderRadius: '6px',
			backgroundColor: theme.bgSecondary,
			color: theme.text,
			cursor: 'pointer',
		}
	}, '✏️');
	workTypeDisplayDiv.appendChild(workTypeDisplayLabel);
	workTypeDisplayDiv.appendChild(editWorkTypeBtn);
	modalContent.appendChild(workTypeDisplayDiv);

	// Subtask Select
	const subtaskDiv = createElement('div', {
		className: 'yt-subtask-select',
		style: { display: 'none' }
	});
	const subtaskLabel = createElement('label', {
		htmlFor: 'yt-subtask',
		style: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }
	}, 'Select Subtask');
	const subtaskSelect = createElement('select', {
		id: 'yt-subtask',
		size: 1,
		style: {
			width: '100%',
			height: '38px',
			padding: '8px 12px',
			fontSize: '14px',
			border: `1px solid ${theme.border}`,
			borderRadius: '6px',
			backgroundColor: theme.bgSecondary,
			color: theme.text,
			cursor: 'pointer',
		}
	});
	subtaskSelect.innerHTML = '<option value="">Loading...</option>';
	subtaskDiv.appendChild(subtaskLabel);
	subtaskDiv.appendChild(subtaskSelect);
	const subtaskHint = createElement('small', {
		style: { display: 'block', marginTop: '4px', fontSize: '12px', color: theme.textSecondary }
	}, 'This story requires time to be logged on a subtask');
	subtaskDiv.appendChild(subtaskHint);

	// Time Input and Subtask container
	const timeAndSubtaskContainer = createElement('div', {
		style: { marginBottom: '16px' }
	});

	const timeDiv = createElement('div', {
		style: { display: isSubdomainSaved && isWorkItemTypeSaved ? 'block' : 'none', marginBottom: '16px' }
	});
	const timeLabel = createElement('label', {
		htmlFor: 'yt-time',
		style: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }
	}, 'Time spent');
	const timeInput = createElement('input', {
		id: 'yt-time',
		type: 'text',
		placeholder: 'e.g., 30m, 2h, 0.5d',
		autoFocus: isSubdomainSaved && isWorkItemTypeSaved,
		style: {
			width: '100%',
			padding: '8px 12px',
			fontSize: '14px',
			border: `1px solid ${theme.border}`,
			borderRadius: '6px',
			backgroundColor: theme.bgSecondary,
			color: theme.text,
		}
	});
	timeDiv.appendChild(timeLabel);
	timeDiv.appendChild(timeInput);

	const commentDiv = createElement('div', {
		style: { display: isSubdomainSaved && isWorkItemTypeSaved ? 'block' : 'none' }
	});
	const commentLabel = createElement('label', {
		htmlFor: 'yt-comment',
		style: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }
	}, 'Comment (optional)');
	const commentInput = createElement('textarea', {
		id: 'yt-comment',
		placeholder: 'Add a description of the work...',
		style: {
			width: '100%',
			padding: '8px 12px',
			fontSize: '14px',
			border: `1px solid ${theme.border}`,
			borderRadius: '6px',
			backgroundColor: theme.bgSecondary,
			color: theme.text,
			minHeight: '60px',
			resize: 'vertical',
			fontFamily: 'inherit',
		}
	});
	commentDiv.appendChild(commentLabel);
	commentDiv.appendChild(commentInput);

	timeAndSubtaskContainer.appendChild(subtaskDiv);
	timeAndSubtaskContainer.appendChild(timeDiv);
	timeAndSubtaskContainer.appendChild(commentDiv);
	modalContent.appendChild(timeAndSubtaskContainer);

	// Error Display
	const errorDiv = createElement('div', {
		className: 'yt-error',
		style: { display: 'none', marginBottom: '16px', padding: '12px', backgroundColor: theme.errorBg, borderRadius: '6px', color: theme.errorText, fontSize: '14px', minHeight: '44px' }
	});
	modalContent.appendChild(errorDiv);

	// Buttons
	const buttonsDiv = createElement('div', {
		style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' }
	});
	const cancelButton = createElement('button', {
		type: 'button',
		className: 'yt-cancel',
		style: {
			padding: '8px 16px',
			fontSize: '14px',
			border: `1px solid ${theme.border}`,
			borderRadius: '6px',
			backgroundColor: theme.bgSecondary,
			color: theme.text,
			cursor: 'pointer',
		}
	}, 'Cancel');
	const submitButton = createElement('button', {
		type: 'button',
		className: 'yt-submit',
		style: {
			padding: '8px 16px',
			fontSize: '14px',
			border: 'none',
			borderRadius: '6px',
			backgroundColor: theme.buttonBg,
			color: '#ffffff',
			cursor: 'pointer',
		}
	}, 'Add Time');
	buttonsDiv.appendChild(cancelButton);
	buttonsDiv.appendChild(submitButton);
	modalContent.appendChild(buttonsDiv);

	overlay.appendChild(modalContent);
	document.body.appendChild(overlay);

	// Helper functions
	const showError = (message) => {
		errorDiv.textContent = message;
		errorDiv.style.display = 'block';
	};

	const closeModal = () => {
		overlay.remove();
	};

	const loadWorkItemTypes = async (subdomain, token) => {
		try {
			const res = await fetchWorkItemTypes(subdomain, token);

			if (!res.ok) {
				throw new Error(res.error || 'Unknown error');
			}

			if (!res.data || !Array.isArray(res.data)) {
				throw new Error('Invalid response data');
			}

			workItemTypes = res.data;
			workTypeSelect.innerHTML = '';

			if (workItemTypes.length === 0) {
				throw new Error('No work item types found');
			}

			workItemTypes.forEach(type => {
				const option = createElement('option', { value: type.id }, type.name);
				workTypeSelect.appendChild(option);
			});

			if (savedWorkItemType && isWorkItemTypeSaved) {
				const saved = JSON.parse(savedWorkItemType);
				workTypeSelect.value = saved.id;
			}
		} catch (error) {
			showError(error.message || 'Failed to load work item types');
			throw error;
		}
	};

	const checkIssueType = async (subdomain, token) => {
		try {
			const res = await fetchIssueDetails(subdomain, issueId, token);

			if (!res.ok) {
				isStoryType = false;
				return;
			}

			if (!res.data || !res.data.customFields) {
				isStoryType = false;
				return;
			}

			const typeField = res.data.customFields.find(field =>
				field.name && field.name.toLowerCase() === 'type'
			);

			if (typeField && typeField.value && typeField.value.name) {
				issueType = typeField.value.name;
				isStoryType = issueType.toLowerCase().includes('story');
			} else {
				isStoryType = false;
			}
		} catch (error) {
			isStoryType = false;
		}
	};

	const loadSubtasks = async (subdomain, token) => {
		try {
			const res = await fetchIssueLinks(subdomain, issueId, token);

			if (!res.ok) {
				throw new Error(res.error || 'Unknown error');
			}

			if (!res.data || !Array.isArray(res.data)) {
				return;
			}

			const subtaskLinks = res.data.filter(link =>
				link.direction === 'OUTWARD' &&
				link.linkType.targetToSource.toLowerCase().includes('subtask of')
			);

			if (subtaskLinks.length === 0) {
				hasSubtasks = false;
				subtaskDiv.style.display = 'none';

				if (isStoryType) {
					showError('This is a Story. Time can only be logged on subtasks, but no subtasks were found.');
					submitButton.disabled = true;
					submitButton.style.backgroundColor = theme.buttonDisabled;
					submitButton.style.cursor = 'not-allowed';
				}
				return;
			}

			subtasks = [];
			subtaskLinks.forEach(link => {
				subtasks.push(...link.trimmedIssues);
			});

			if (subtasks.length === 0) {
				hasSubtasks = false;
				subtaskDiv.style.display = 'none';

				if (isStoryType) {
					showError('This is a Story. Time can only be logged on subtasks, but no subtasks were found.');
					submitButton.disabled = true;
					submitButton.style.backgroundColor = theme.buttonDisabled;
					submitButton.style.cursor = 'not-allowed';
				}
				return;
			}

			hasSubtasks = true;

			if (isStoryType) {
				subtaskDiv.style.display = 'block';
			}

			subtaskSelect.innerHTML = '';
			subtasks.forEach(subtask => {
				const option = createElement('option', { value: subtask.idReadable }, `${subtask.idReadable} - ${subtask.summary}`);
				subtaskSelect.appendChild(option);
			});
		} catch (error) {
			hasSubtasks = false;
			subtaskDiv.style.display = 'none';
		}
	};

	if (isSubdomainSaved && isTokenSaved) {
		loadWorkItemTypes(savedSubdomain, savedToken);
		checkIssueType(savedSubdomain, savedToken).then(() => {
			loadSubtasks(savedSubdomain, savedToken);
		});
	}

	// Event listeners
	saveSubdomainBtn.addEventListener('click', async () => {
		errorDiv.style.display = 'none';
		const subdomain = subdomainInput.value.trim();
		if (!subdomain) {
			showError('Please enter a YouTrack subdomain');
			return;
		}

		localStorage.setItem(STORAGE_KEY_SUBDOMAIN, subdomain);
		isSubdomainSaved = true;

		subdomainInputDiv.style.display = 'none';
		subdomainDisplayDiv.style.display = 'flex';
		subdomainDisplayLabel.innerHTML = `Organization: <strong style="color: ${theme.text}">${subdomain}</strong>.youtrack.cloud`;

		// Only show token input if not already saved
		if (!isTokenSaved) {
			tokenInputDiv.style.display = 'block';
			tokenInput.focus();
		}
	});

	subdomainInput.addEventListener('keydown', event => {
		if (event.key === 'Enter') {
			event.preventDefault();
			saveSubdomainBtn.click();
		}
	});

	editSubdomainBtn.addEventListener('click', () => {
		isSubdomainSaved = false;
		subdomainInputDiv.style.display = 'block';
		subdomainDisplayDiv.style.display = 'none';
		subdomainInput.focus();
	});

	saveTokenBtn.addEventListener('click', async () => {
		errorDiv.style.display = 'none';
		const token = tokenInput.value.trim();
		if (!token) {
			showError('Please enter your YouTrack token');
			return;
		}

		try {
			saveTokenBtn.disabled = true;
			saveTokenBtn.textContent = 'Testing...';

			const subdomain = localStorage.getItem(STORAGE_KEY_SUBDOMAIN);
			if (!subdomain) {
				throw new Error('Subdomain not found');
			}

			await loadWorkItemTypes(subdomain, token);

			localStorage.setItem(STORAGE_KEY_TOKEN, token);
			isTokenSaved = true;

			await checkIssueType(subdomain, token);
			await loadSubtasks(subdomain, token);

			tokenInputDiv.style.display = 'none';
			tokenDisplayDiv.style.display = 'flex';

			// Only show work type selector if not already saved
			if (!isWorkItemTypeSaved) {
				workTypeDiv.style.display = 'block';
			}

			workTypeSelect.style.backgroundColor = theme.bgSecondary;
			workTypeSelect.style.color = theme.text;
			workTypeSelect.style.cursor = 'pointer';

			saveWorkTypeBtn.style.backgroundColor = theme.buttonBg;
			saveWorkTypeBtn.style.cursor = 'pointer';
		} catch (error) {
			showError(error.message || 'Failed to authenticate with YouTrack');
		} finally {
			saveTokenBtn.disabled = false;
			saveTokenBtn.textContent = 'Save';
		}
	});

	tokenInput.addEventListener('keydown', event => {
		if (event.key === 'Enter') {
			event.preventDefault();
			saveTokenBtn.click();
		}
	});

	editTokenBtn.addEventListener('click', () => {
		isTokenSaved = false;
		tokenInputDiv.style.display = 'block';
		tokenDisplayDiv.style.display = 'none';
		tokenInput.focus();
	});

	saveWorkTypeBtn.addEventListener('click', () => {
		errorDiv.style.display = 'none';
		const workTypeId = workTypeSelect.value;
		if (!workTypeId) {
			showError('Please select a work item type');
			return;
		}

		const selectedType = workItemTypes.find(t => t.id === workTypeId);
		if (selectedType) {
			localStorage.setItem(STORAGE_KEY_WORK_ITEM_TYPE, JSON.stringify(selectedType));
			isWorkItemTypeSaved = true;

			workTypeDiv.style.display = 'none';
			workTypeDisplayDiv.style.display = 'flex';
			workTypeDisplayDiv.querySelector('.yt-work-type-value').textContent = selectedType.name;

			timeDiv.style.display = 'block';
			commentDiv.style.display = 'block';
			timeInput.focus();
		}
	});

	editWorkTypeBtn.addEventListener('click', () => {
		isWorkItemTypeSaved = false;
		workTypeDiv.style.display = 'block';
		workTypeDisplayDiv.style.display = 'none';

		const savedSubdomainInner = localStorage.getItem(STORAGE_KEY_SUBDOMAIN);
		const savedTokenInner = localStorage.getItem(STORAGE_KEY_TOKEN);
		if (savedSubdomainInner && savedTokenInner && workItemTypes.length === 0) {
			loadWorkItemTypes(savedSubdomainInner, savedTokenInner);
		}
	});

	cancelButton.addEventListener('click', closeModal);

	// Only close if both mousedown and mouseup happen on overlay
	let mouseDownOnOverlay = false;
	overlay.addEventListener('mousedown', event => {
		if (event.target === overlay) {
			mouseDownOnOverlay = true;
		}
	});
	overlay.addEventListener('mouseup', event => {
		if (event.target === overlay && mouseDownOnOverlay) {
			closeModal();
		}
		mouseDownOnOverlay = false;
	});

	submitButton.addEventListener('click', async () => {
		errorDiv.style.display = 'none';

		if (!isSubdomainSaved || !isTokenSaved || !isWorkItemTypeSaved) {
			showError('Please complete setup first (subdomain, token, and work item type)');
			return;
		}

		try {
			const timeStr = timeInput.value.trim();
			if (!timeStr) {
				throw new Error('Please enter time spent');
			}

			const minutes = parseTimeToMinutes(timeStr);

			const subdomain = localStorage.getItem(STORAGE_KEY_SUBDOMAIN);
			const token = localStorage.getItem(STORAGE_KEY_TOKEN);
			const workItemType = localStorage.getItem(STORAGE_KEY_WORK_ITEM_TYPE);

			if (!subdomain || !token || !workItemType) {
				throw new Error('Configuration missing');
			}

			const workItemTypeId = JSON.parse(workItemType).id;

			let targetIssueId = issueId;

			if (isStoryType) {
				if (!hasSubtasks) {
					throw new Error('This is a Story. Time can only be logged on subtasks.');
				}
				const selectedSubtask = subtaskSelect.value;
				if (!selectedSubtask) {
					throw new Error('Please select a subtask');
				}
				targetIssueId = selectedSubtask;
			} else if (hasSubtasks) {
				const selectedSubtask = subtaskSelect.value;
				if (selectedSubtask) {
					targetIssueId = selectedSubtask;
				}
			}

			submitButton.disabled = true;
			submitButton.textContent = 'Adding...';

			const request = {
				duration: {
					minutes,
					$type: 'DurationValue',
				},
				date: Date.now(),
				type: {
					id: workItemTypeId,
					$type: 'WorkItemType',
				},
				$type: 'IssueWorkItem',
			};

			const commentText = commentInput.value.trim();
			if (commentText) {
				request.text = commentText;
			}

			const res = await addSpentTime(subdomain, targetIssueId, request, token);
			if (!res.ok) throw new Error(res.error);

			closeModal();

			// Show success notification
			const notification = createElement('div', {
				style: {
					position: 'fixed',
					top: '16px',
					right: '16px',
					backgroundColor: theme.buttonBg,
					color: '#ffffff',
					padding: '12px 16px',
					borderRadius: '6px',
					zIndex: '10000',
					fontSize: '14px',
					boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
				}
			}, `✓ Time added to ${targetIssueId}`);
			document.body.appendChild(notification);
			setTimeout(() => {
				notification.remove();
			}, 3000);
		} catch (error) {
			showError(error.message || 'An error occurred');
			submitButton.disabled = false;
			submitButton.textContent = 'Add Time';
		}
	});

	timeInput.addEventListener('keydown', event => {
		if (event.key === 'Enter') {
			event.preventDefault();
			submitButton.click();
		}

		if (event.key === 'Escape') {
			closeModal();
		}
	});
}

function addTimeButton() {
	const issueId = extractYouTrackId();
	if (!issueId) {
		return;
	}

	// Try new GitHub UI first (2024+), then fall back to old selector
	const header = document.querySelector('[data-component="PH_Actions"]') ||
		document.querySelector('.gh-header-actions');
	if (!header) {
		return;
	}

	if (header.querySelector('.yt-time-button')) {
		return;
	}

	const btn = createElement('button', {
		type: 'button',
		className: 'yt-time-button btn btn-sm d-none d-md-block',
		title: `Add time to ${issueId}`,
		style: {
			marginRight: '8px',
		}
	});

	// Clock icon SVG
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('class', 'octicon');
	svg.setAttribute('viewBox', '0 0 16 16');
	svg.setAttribute('width', '16');
	svg.setAttribute('height', '16');
	svg.setAttribute('style', 'margin-right: 4px; vertical-align: text-top;');
	const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	path.setAttribute('d', 'M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z');
	svg.appendChild(path);

	btn.appendChild(svg);
	btn.appendChild(document.createTextNode('Add Time'));

	btn.addEventListener('click', () => {
		createModal(issueId);
	});

	header.prepend(btn);
}

/**
 * Checks if current page is an individual PR page
 * @returns {boolean}
 */
function isPRPage() {
	return PR_PAGE_PATTERN.test(location.href);
}

/**
 * Try to add button - checks all conditions before adding
 */
function tryAddButton() {
	if (!isPRPage()) {
		return;
	}

	const issueId = extractYouTrackId();
	if (!issueId) {
		return; // Title not loaded yet or no YouTrack ID
	}

	// Try new GitHub UI first (2024+), then fall back to old selector
	const header = document.querySelector('[data-component="PH_Actions"]') ||
		document.querySelector('.gh-header-actions');
	if (!header) {
		return; // Header not loaded yet
	}

	const buttonExists = header.querySelector('.yt-time-button') !== null;
	if (buttonExists) {
		return;
	}

	addTimeButton();
}

// Initialize
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', tryAddButton);
} else {
	tryAddButton();
}

// Listen for GitHub's Turbo navigation events
document.addEventListener('turbo:load', tryAddButton);
document.addEventListener('turbo:render', tryAddButton);

// Also listen for older pjax events (fallback)
document.addEventListener('pjax:end', tryAddButton);

// Watch for navigation changes and DOM updates with throttling
let lastUrl = location.href;
let throttleTimeout = null;

const observer = new MutationObserver(() => {
	const currentUrl = location.href;
	const urlChanged = currentUrl !== lastUrl;

	if (urlChanged) {
		lastUrl = currentUrl;
		tryAddButton();
		return;
	}

	// Throttle DOM change checks to avoid excessive calls
	if (throttleTimeout === null) {
		throttleTimeout = setTimeout(() => {
			tryAddButton();
			throttleTimeout = null;
		}, THROTTLE_DELAY_MS);
	}
});

observer.observe(document, { subtree: true, childList: true });

// Poll periodically for initial page load
let pollCount = 0;
const pollInterval = setInterval(() => {
	tryAddButton();
	pollCount++;

	const maxAttemptsReached = pollCount >= POLL_MAX_ATTEMPTS;
	if (maxAttemptsReached) {
		clearInterval(pollInterval);
	}
}, POLL_INTERVAL_MS);
