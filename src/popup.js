const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

const addBtn = document.getElementById('add-button');
const resetBtn = document.getElementById('reset-locations');
const status = document.getElementById('status');

async function getCurrentTab() {
	const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
	return tabs[0];
}

function isPRPage(url) {
	return url && /github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(url);
}

async function init() {
	const tab = await getCurrentTab();

	if (!isPRPage(tab.url)) {
		addBtn.classList.add('disabled');
		status.textContent = 'Navigate to a GitHub PR to add buttons.';
		return;
	}

	status.textContent = 'On PR page - ready!';
}

addBtn.addEventListener('click', async () => {
	const tab = await getCurrentTab();

	if (!isPRPage(tab.url)) {
		status.textContent = 'Not on a PR page.';
		return;
	}

	await browserAPI.tabs.sendMessage(tab.id, { action: 'enterPickerMode' });
	window.close();
});

resetBtn.addEventListener('click', async () => {
	const tab = await getCurrentTab();

	await browserAPI.tabs.sendMessage(tab.id, { action: 'resetButtonLocations' });
	status.textContent = 'Locations reset!';
});

init();
