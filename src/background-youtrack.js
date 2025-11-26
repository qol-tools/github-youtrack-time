// Simple background script for YouTrack CORS bypass - no imports, plain JS
// Compatible with both MV2 (background pages) and MV3 (service workers)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === 'ytbridge.request') {
		// Handle async request and send response
		handleYouTrackRequest(message)
			.then(sendResponse)
			.catch(error => {
				sendResponse({ ok: false, error: error.message || 'Request failed' });
			});
		return true; // Keep message channel open for async response
	}
	return false;
});

async function handleYouTrackRequest(message) {
	const { url, method, headers, body } = message;

	try {
		const response = await fetch(url, {
			method: method || 'GET',
			headers: headers || {},
			body: body ? JSON.stringify(body) : undefined,
		});

		let data = null;
		const contentType = response.headers.get('content-type');

		if (response.ok) {
			// Try to parse as JSON if content-type indicates JSON
			if (contentType && contentType.includes('application/json')) {
				try {
					data = await response.json();
				} catch {
					data = await response.text();
				}
			} else {
				data = await response.text();
			}
			return { ok: true, data: data, status: response.status };
		} else {
			// Handle error response
			let errorMsg = 'HTTP ' + response.status;
			try {
				if (contentType && contentType.includes('application/json')) {
					const errorData = await response.json();
					errorMsg = errorData.error_description || errorData.error || errorMsg;
				} else {
					errorMsg = await response.text() || errorMsg;
				}
			} catch {
				// If parsing fails, use status message
			}
			return { ok: false, error: errorMsg, status: response.status };
		}
	} catch (error) {
		return { ok: false, error: error.message || 'Network error' };
	}
}
