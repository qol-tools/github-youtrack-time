// Simple background script for YouTrack CORS bypass - no imports, plain JS

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === 'ytbridge.request') {
		const { url, method, headers, body } = message;

		const xhr = new XMLHttpRequest();
		xhr.open(method || 'GET', url, true);

		// Set headers
		if (headers) {
			for (const key in headers) {
				if (headers.hasOwnProperty(key)) {
					xhr.setRequestHeader(key, headers[key]);
				}
			}
		}

		xhr.onload = () => {
			let data = null;
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					data = JSON.parse(xhr.responseText);
				} catch {
					data = xhr.responseText;
				}
				sendResponse({ ok: true, data: data, status: xhr.status });
			} else {
				let errorMsg = 'HTTP ' + xhr.status;
				try {
					const errorData = JSON.parse(xhr.responseText);
					errorMsg = errorData.error_description || errorData.error || xhr.responseText;
				} catch {
					errorMsg = xhr.responseText || errorMsg;
				}
				sendResponse({ ok: false, error: errorMsg, status: xhr.status });
			}
		};

		xhr.onerror = () => {
			sendResponse({ ok: false, error: 'Network error' });
		};

		xhr.ontimeout = () => {
			sendResponse({ ok: false, error: 'Request timeout' });
		};

		try {
			if (body) {
				xhr.send(JSON.stringify(body));
			} else {
				xhr.send();
			}
		} catch (error) {
			sendResponse({ ok: false, error: 'Failed to send request' });
		}

		return true; // Keep message channel open
	}

	return false;
});
