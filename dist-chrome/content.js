// GitHub YouTrack Time Tracker - Standalone Extension
// Storage keys
const STORAGE_KEY_SUBDOMAIN = 'yt-subdomain';
const STORAGE_KEY_WORK_ITEM_TYPE = 'yt-work-item-type';
const STORAGE_KEY_TOKEN = 'yt-token';

// API Functions
async function fetchWorkItemTypes(subdomain, token) {
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
		return { ok: false, error: error.message || 'Request failed' };
	}
}

async function fetchIssueLinks(subdomain, issueId, token) {
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

async function addSpentTime(subdomain, issueId, request, token) {
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

function extractYouTrackId() {
	const titleEl = document.querySelector('.gh-header-title .js-issue-title');
	if (!titleEl) {
		return null;
	}
	const match = titleEl.textContent?.match(/[A-Z]+-\d+/);
	return match ? match[0] : null;
}

function parseTimeToMinutes(timeStr) {
	const match = timeStr.match(/^(\d+(?:\.\d+)?)\s*([mhd])?$/i);
	if (!match) {
		throw new Error('Invalid time format. Use: 5m, 1h, 1d, etc.');
	}

	const value = parseFloat(match[1]);
	const unit = (match[2] || 'm').toLowerCase();

	switch (unit) {
		case 'm':
			return Math.round(value);
		case 'h':
			return Math.round(value * 60);
		case 'd':
			return Math.round(value * 60 * 8); // 8 hour workday
		default:
			throw new Error('Invalid time unit. Use: m (minutes), h (hours), d (days)');
	}
}

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

	const overlay = createElement('div', {
		className: 'yt-time-modal',
		style: {
			position: 'fixed',
			top: '0',
			left: '0',
			right: '0',
			bottom: '0',
			backgroundColor: 'rgba(0, 0, 0, 0.7)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: '9999',
		}
	});

	const modalContent = createElement('div', {
		className: 'yt-time-modal-content',
		style: {
			backgroundColor: '#ffffff',
			border: '1px solid #d1d5da',
			borderRadius: '6px',
			padding: '24px',
			width: '400px',
			boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
			color: '#24292e',
		}
	});

	// Title
	const title = createElement('h2', {
		style: { margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }
	}, `Add Spent Time to ${issueId}`);
	modalContent.appendChild(title);

	// Subdomain Input
	const subdomainInputDiv = createElement('div', {
		className: 'yt-subdomain-input',
		style: { marginBottom: '16px', display: !isSubdomainSaved ? 'block' : 'none' }
	});
	const subdomainLabel = createElement('label', {
		htmlFor: 'yt-subdomain',
		style: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }
	}, 'YouTrack Subdomain');
	const subdomainInputGroup = createElement('div', { style: { display: 'flex', gap: '8px' } });
	const subdomainInput = createElement('input', {
		id: 'yt-subdomain',
		type: 'text',
		placeholder: 'e.g., mycompany',
		value: savedSubdomain || '',
		style: {
			flex: '1',
			padding: '8px 12px',
			fontSize: '14px',
			border: '1px solid #d1d5da',
			borderRadius: '6px',
			backgroundColor: '#f6f8fa',
			color: '#24292e',
		}
	});
	const saveSubdomainBtn = createElement('button', {
		type: 'button',
		className: 'yt-save-subdomain',
		style: {
			padding: '8px 16px',
			fontSize: '14px',
			border: '1px solid #d1d5da',
			borderRadius: '6px',
			backgroundColor: '#2da44e',
			color: '#ffffff',
			cursor: 'pointer',
			whiteSpace: 'nowrap',
		}
	}, 'Save');
	subdomainInputGroup.appendChild(subdomainInput);
	subdomainInputGroup.appendChild(saveSubdomainBtn);
	subdomainInputDiv.appendChild(subdomainLabel);
	subdomainInputDiv.appendChild(subdomainInputGroup);
	const subdomainHint = createElement('small', {
		style: { display: 'block', marginTop: '4px', fontSize: '12px', color: '#57606a' }
	}, 'From: mycompany.youtrack.cloud');
	subdomainInputDiv.appendChild(subdomainHint);
	modalContent.appendChild(subdomainInputDiv);

	// Subdomain Display
	const subdomainDisplayDiv = createElement('div', {
		className: 'yt-subdomain-display',
		style: { marginBottom: '16px', display: isSubdomainSaved ? 'flex' : 'none', alignItems: 'center', gap: '8px' }
	});
	const subdomainDisplayLabel = createElement('label', {
		style: { flex: '1', fontSize: '14px', color: '#57606a' }
	});
	subdomainDisplayLabel.innerHTML = `Organization: <strong style="color: #24292e">${savedSubdomain || ''}</strong>.youtrack.cloud`;
	const editSubdomainBtn = createElement('button', {
		type: 'button',
		className: 'yt-edit-subdomain',
		style: {
			padding: '4px 8px',
			border: '1px solid #d1d5da',
			borderRadius: '6px',
			backgroundColor: '#f6f8fa',
			color: '#24292e',
			cursor: 'pointer',
		}
	}, '✏️');
	subdomainDisplayDiv.appendChild(subdomainDisplayLabel);
	subdomainDisplayDiv.appendChild(editSubdomainBtn);
	modalContent.appendChild(subdomainDisplayDiv);

	// Token Input
	const tokenInputDiv = createElement('div', {
		className: 'yt-token-input',
		style: { marginBottom: '16px', display: isSubdomainSaved && !isTokenSaved ? 'block' : 'none' }
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
		value: savedToken || '',
		style: {
			flex: '1',
			padding: '8px 12px',
			fontSize: '14px',
			border: '1px solid #d1d5da',
			borderRadius: '6px',
			backgroundColor: '#f6f8fa',
			color: '#24292e',
			fontFamily: 'monospace',
		}
	});
	const saveTokenBtn = createElement('button', {
		type: 'button',
		className: 'yt-save-token',
		style: {
			padding: '8px 16px',
			fontSize: '14px',
			border: '1px solid #d1d5da',
			borderRadius: '6px',
			backgroundColor: '#2da44e',
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
		style: { display: 'block', marginTop: '4px', fontSize: '12px', color: '#57606a' }
	}, 'Get permanent token: Profile → Authentication → New token... → Paste here');
	tokenInputDiv.appendChild(tokenHint);
	modalContent.appendChild(tokenInputDiv);

	// Token Display
	const tokenDisplayDiv = createElement('div', {
		className: 'yt-token-display',
		style: { marginBottom: '16px', display: isTokenSaved ? 'flex' : 'none', alignItems: 'center', gap: '8px' }
	});
	const tokenDisplayLabel = createElement('label', {
		style: { flex: '1', fontSize: '14px', color: '#57606a' }
	});
	tokenDisplayLabel.innerHTML = 'Token: <span style="font-family: monospace">••••••••</span>';
	const editTokenBtn = createElement('button', {
		type: 'button',
		className: 'yt-edit-token',
		style: {
			padding: '4px 8px',
			border: '1px solid #d1d5da',
			borderRadius: '6px',
			backgroundColor: '#f6f8fa',
			color: '#24292e',
			cursor: 'pointer',
		}
	}, '✏️');
	tokenDisplayDiv.appendChild(tokenDisplayLabel);
	tokenDisplayDiv.appendChild(editTokenBtn);
	modalContent.appendChild(tokenDisplayDiv);

	// Work Item Type Select
	const workTypeDiv = createElement('div', {
		className: 'yt-work-type-container',
		style: { marginBottom: '16px', display: isSubdomainSaved && isTokenSaved && !isWorkItemTypeSaved ? 'block' : 'none', opacity: isSubdomainSaved && isTokenSaved ? '1' : '0.5' }
	});
	const workTypeLabel = createElement('label', {
		htmlFor: 'yt-work-type',
		style: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }
	}, 'Work Item Type');
	const workTypeGroup = createElement('div', { style: { display: 'flex', gap: '8px' } });
	const workTypeSelect = createElement('select', {
		id: 'yt-work-type',
		disabled: !isSubdomainSaved,
		style: {
			flex: '1',
			padding: '8px 12px',
			fontSize: '14px',
			border: '1px solid #d1d5da',
			borderRadius: '6px',
			backgroundColor: isSubdomainSaved ? '#f6f8fa' : '#e5e7eb',
			color: isSubdomainSaved ? '#24292e' : '#9ca3af',
			cursor: isSubdomainSaved ? 'pointer' : 'not-allowed',
		}
	});
	workTypeSelect.innerHTML = '<option value="">Loading...</option>';
	const saveWorkTypeBtn = createElement('button', {
		type: 'button',
		className: 'yt-save-work-type',
		disabled: !isSubdomainSaved,
		style: {
			padding: '8px 16px',
			fontSize: '14px',
			border: '1px solid #d1d5da',
			borderRadius: '6px',
			backgroundColor: isSubdomainSaved ? '#2da44e' : '#e5e7eb',
			color: '#ffffff',
			cursor: isSubdomainSaved ? 'pointer' : 'not-allowed',
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
		style: { marginBottom: '16px', display: isWorkItemTypeSaved ? 'flex' : 'none', alignItems: 'center', gap: '8px' }
	});
	const workTypeDisplayLabel = createElement('label', {
		style: { flex: '1', fontSize: '14px', color: '#57606a' }
	});
	const savedTypeObj = savedWorkItemType ? JSON.parse(savedWorkItemType) : null;
	workTypeDisplayLabel.innerHTML = `Work Item Type: <span class="yt-work-type-value">${savedTypeObj ? savedTypeObj.name : ''}</span>`;
	const editWorkTypeBtn = createElement('button', {
		type: 'button',
		className: 'yt-edit-work-type',
		style: {
			padding: '4px 8px',
			border: '1px solid #d1d5da',
			borderRadius: '6px',
			backgroundColor: '#f6f8fa',
			color: '#24292e',
			cursor: 'pointer',
		}
	}, '✏️');
	workTypeDisplayDiv.appendChild(workTypeDisplayLabel);
	workTypeDisplayDiv.appendChild(editWorkTypeBtn);
	modalContent.appendChild(workTypeDisplayDiv);

	// Subtask Select
	const subtaskDiv = createElement('div', {
		className: 'yt-subtask-select',
		style: { marginBottom: '16px', display: 'none' }
	});
	const subtaskLabel = createElement('label', {
		htmlFor: 'yt-subtask',
		style: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }
	}, 'Select Subtask');
	const subtaskSelect = createElement('select', {
		id: 'yt-subtask',
		style: {
			width: '100%',
			padding: '8px 12px',
			fontSize: '14px',
			border: '1px solid #d1d5da',
			borderRadius: '6px',
			backgroundColor: '#f6f8fa',
			color: '#24292e',
			cursor: 'pointer',
		}
	});
	subtaskSelect.innerHTML = '<option value="">Loading...</option>';
	subtaskDiv.appendChild(subtaskLabel);
	subtaskDiv.appendChild(subtaskSelect);
	const subtaskHint = createElement('small', {
		style: { display: 'block', marginTop: '4px', fontSize: '12px', color: '#57606a' }
	}, 'This story requires time to be logged on a subtask');
	subtaskDiv.appendChild(subtaskHint);
	modalContent.appendChild(subtaskDiv);

	// Time Input
	const timeDiv = createElement('div', {
		style: { marginBottom: '16px', display: isSubdomainSaved && isWorkItemTypeSaved ? 'block' : 'none' }
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
			border: '1px solid #d1d5da',
			borderRadius: '6px',
			backgroundColor: '#f6f8fa',
			color: '#24292e',
		}
	});
	timeDiv.appendChild(timeLabel);
	timeDiv.appendChild(timeInput);
	modalContent.appendChild(timeDiv);

	// Error Display
	const errorDiv = createElement('div', {
		className: 'yt-error',
		style: { display: 'none', marginBottom: '16px', padding: '12px', backgroundColor: '#ffeef0', borderRadius: '6px', color: '#d1242f', fontSize: '14px' }
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
			border: '1px solid #d1d5da',
			borderRadius: '6px',
			backgroundColor: '#f6f8fa',
			color: '#24292e',
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
			backgroundColor: '#2da44e',
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

	const loadSubtasks = async (subdomain, token) => {
		try {
			const res = await fetchIssueLinks(subdomain, issueId, token);

			if (!res.ok) {
				throw new Error(res.error || 'Unknown error');
			}

			if (!res.data || !Array.isArray(res.data)) {
				return;
			}

			// Filter for subtasks
			const subtaskLinks = res.data.filter(link =>
				link.linkType.targetToSource.toLowerCase().includes('subtask of')
			);

			if (subtaskLinks.length === 0) {
				hasSubtasks = false;
				subtaskDiv.style.display = 'none';
				return;
			}

			// Extract all subtasks
			subtasks = [];
			subtaskLinks.forEach(link => {
				subtasks.push(...link.trimmedIssues);
			});

			if (subtasks.length === 0) {
				hasSubtasks = false;
				subtaskDiv.style.display = 'none';
				return;
			}

			hasSubtasks = true;
			subtaskDiv.style.display = 'block';

			// Populate select
			subtaskSelect.innerHTML = '';
			subtasks.forEach(subtask => {
				const option = createElement('option', { value: subtask.idReadable }, `${subtask.idReadable} - ${subtask.summary}`);
				subtaskSelect.appendChild(option);
			});
		} catch (error) {
			// Subtasks are optional
			hasSubtasks = false;
			subtaskDiv.style.display = 'none';
		}
	};

	if (isSubdomainSaved && isTokenSaved) {
		loadWorkItemTypes(savedSubdomain, savedToken);
		loadSubtasks(savedSubdomain, savedToken);
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
		subdomainDisplayLabel.innerHTML = `Organization: <strong style="color: #24292e">${subdomain}</strong>.youtrack.cloud`;

		tokenInputDiv.style.display = 'block';
		tokenInput.focus();
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

			tokenInputDiv.style.display = 'none';
			tokenDisplayDiv.style.display = 'flex';
			workTypeDiv.style.display = 'block';

			workTypeSelect.disabled = false;
			workTypeSelect.style.backgroundColor = '#f6f8fa';
			workTypeSelect.style.color = '#24292e';
			workTypeSelect.style.cursor = 'pointer';

			saveWorkTypeBtn.disabled = false;
			saveWorkTypeBtn.style.backgroundColor = '#2da44e';
			saveWorkTypeBtn.style.cursor = 'pointer';
		} catch (error) {
			showError(error.message || 'Failed to authenticate with YouTrack');
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
	overlay.addEventListener('click', event => {
		if (event.target === overlay) {
			closeModal();
		}
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

			// Determine target issue
			let targetIssueId = issueId;
			if (hasSubtasks) {
				const selectedSubtask = subtaskSelect.value;
				if (!selectedSubtask) {
					throw new Error('Please select a subtask');
				}
				targetIssueId = selectedSubtask;
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

			const res = await addSpentTime(subdomain, targetIssueId, request, token);
			if (!res.ok) throw new Error(res.error);

			closeModal();

			// Show success notification
			const notification = createElement('div', {
				style: {
					position: 'fixed',
					top: '16px',
					right: '16px',
					backgroundColor: '#2da44e',
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

	const header = document.querySelector('.gh-header-actions');
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

// Initialize
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', addTimeButton);
} else {
	addTimeButton();
}

// Watch for navigation changes and header appearance (GitHub uses PJAX)
let lastUrl = location.href;
new MutationObserver(() => {
	const url = location.href;
	if (url !== lastUrl) {
		lastUrl = url;
	}

	// Try to add button whenever DOM changes
	const header = document.querySelector('.gh-header-actions');
	if (header && !header.querySelector('.yt-time-button')) {
		addTimeButton();
	}
}).observe(document, { subtree: true, childList: true });
