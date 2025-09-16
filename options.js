// Options page script for ALT Input Translator

// Load stored settings when the options page is opened
document.addEventListener('DOMContentLoaded', function () {
    const apiKeyInput = document.getElementById('apiKey');
    const targetLangInput = document.getElementById('targetLang');
    const statusEl = document.getElementById('status');

    // Load existing settings from storage
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['apiKey', 'targetLang'], (items) => {
            if (items.apiKey) {
                apiKeyInput.value = items.apiKey;
            }
            if (items.targetLang) {
                targetLangInput.value = items.targetLang;
            }
        });
    }

    // Save settings when form is submitted
    document.getElementById('settingsForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const apiKey = apiKeyInput.value.trim();
        const targetLang = targetLangInput.value.trim() || 'en';
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ apiKey, targetLang }, () => {
                statusEl.textContent = 'Saved!';
                // hide status after a few seconds
                setTimeout(() => { statusEl.textContent = ''; }, 2000);
            });
        }
    });
});