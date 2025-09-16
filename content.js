
// Default API key and target language. These are overridden by values stored in chrome.storage.local.
const API_KEY_DEFAULT = "";
const TARGET_LANG_DEFAULT = "en";

// Retrieve settings (API key and target language) from chrome.storage.local.
// Returns a promise resolving to an object { apiKey, targetLang }.
async function getSettings() {
    return await new Promise((resolve) => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['apiKey', 'targetLang'], (items) => {
                    resolve({
                        apiKey: items && items.apiKey ? items.apiKey : API_KEY_DEFAULT,
                        targetLang: items && items.targetLang ? items.targetLang : TARGET_LANG_DEFAULT
                    });
                });
            } else {
                resolve({ apiKey: API_KEY_DEFAULT, targetLang: TARGET_LANG_DEFAULT });
            }
        } catch (err) {
            resolve({ apiKey: API_KEY_DEFAULT, targetLang: TARGET_LANG_DEFAULT });
        }
    });
}

let _lastTranslateAt = 0;
const _DEBOUNCE_MS = 600; // ignore presses within 600ms

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

function showTooltip(el, message) {
    try {
        let tooltip = document.createElement("div");
        tooltip.textContent = message;
        tooltip.style.position = "absolute";
        tooltip.style.background = "rgba(0,0,0,0.85)";
        tooltip.style.color = "white";
        tooltip.style.padding = "6px 10px";
        tooltip.style.borderRadius = "6px";
        tooltip.style.fontSize = "12px";
        tooltip.style.zIndex = 2147483647;
        const rect = (el && el.getBoundingClientRect) ? el.getBoundingClientRect() : {top: window.scrollY + 10, left: window.scrollX + 10};
        tooltip.style.top = (rect.top - 36 + window.scrollY) + "px";
        tooltip.style.left = (rect.left) + "px";
        document.body.appendChild(tooltip);
        setTimeout(() => tooltip.remove(), 1600);
    } catch (e) {
        // ignore
    }
}

async function translateText(text) {
    // Pull dynamic settings. If no API key, throw so caller can display message.
    const { apiKey, targetLang } = await getSettings();
    if (!apiKey) {
        throw new Error('API key not configured');
    }
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            q: text,
            source: "vi",
            target: targetLang,
            format: "text"
        })
    });
    const data = await res.json();
    if (data && data.data && data.data.translations && data.data.translations[0]) {
        return data.data.translations[0].translatedText;
    }
    throw new Error("No translation returned");
}

function findEditableAncestor(el) {
    if (!el) return null;
    let cur = el;
    while (cur && cur !== document.documentElement) {
        if (cur.isContentEditable) return cur;
        cur = cur.parentElement;
    }
    return null;
}

function dispatchInputEvents(el) {
    try {
        const inputEvent = new InputEvent('input', { bubbles: true, cancelable: true, composed: true });
        el.dispatchEvent(inputEvent);
        const changeEvent = new Event('change', { bubbles: true });
        el.dispatchEvent(changeEvent);
        // Some editors respond to key events as well
        const keyEvt = new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Unidentified' });
        el.dispatchEvent(keyEvt);
    } catch (e) {
        // ignore
    }
}

function textEqualsNormalized(a, b){
    if(a===undefined || b===undefined) return false;
    return a.replace(/\s+/g,' ').trim() === b.replace(/\s+/g,' ').trim();
}

async function deleteSelectionOrContents(el) {
    const sel = window.getSelection();
    try {
        if (sel && sel.rangeCount > 0) {
            const r = sel.getRangeAt(0);
            // If the selection belongs to our element and actually spans text (not just a caret)
            if (el.contains(r.commonAncestorContainer) && r.toString().trim().length > 0) {
                // Delete selected contents via Range API so DOM updates
                r.deleteContents();
                // Notify rich-text editors (Lexical, Quill, etc.) about deletion
                try {
                    document.execCommand && document.execCommand('delete');
                } catch (_) {}
                // Collapse caret to the start of what was deleted
                r.collapse(true);
                sel.removeAllRanges();
                sel.addRange(r);
                return;
            }
        }
    } catch (e) {
        // ignore and fallback to clearing entire content
    }
    // At this point we either have no selection or only a caret. Replace the entire content.
    try {
        // Bring focus to the element so execCommand works reliably
        el.focus && el.focus();
        // Select all contents via execCommand (equivalent to Ctrl+A)
        try {
            document.execCommand && document.execCommand('selectAll');
        } catch (_) {}
        // Delete everything via execCommand (equivalent to Delete key)
        try {
            document.execCommand && document.execCommand('delete');
        } catch (_) {}
        // Also clear DOM text nodes just in case
        try {
            const r2 = document.createRange();
            r2.selectNodeContents(el);
            r2.deleteContents();
            r2.collapse(true);
            const sel2 = window.getSelection();
            sel2.removeAllRanges();
            sel2.addRange(r2);
        } catch (_) {}
    } catch (e) {
        // final fallback: set empty text directly
        try {
            el.innerText = "";
        } catch (_) {
            try { el.textContent = ""; } catch(_){}
        }
    }
}

async function attemptPasteSequence(el, text) {
    const prior = (el.innerText || "");
    // 1) copy to clipboard
    try {
        await navigator.clipboard.writeText(text);
    } catch (e) {
        // ignore clipboard write failure, we'll still try paste event
    }

    // Ensure we start with cleared content/selection
    await deleteSelectionOrContents(el);

    // Helper to check if insertion succeeded
    function isInserted() {
        const now = (el.innerText || "");
        if (!text) {
            return !textEqualsNormalized(now, prior) && now.trim().length>0;
        }
        // success if new content contains translated text or is different from prior
        return now.includes(text) || (!textEqualsNormalized(now, prior) && now.trim().length>0);
    }

    // Try 0: use execCommand('insertText') which editors like Facebook Lexical understand
    try {
        el.focus();
        // Insert the text at the current caret position, replacing any existing selection
        const okInsert = document.execCommand && document.execCommand('insertText', false, text);
        dispatchInputEvents(el);
        await sleep(120);
        if (isInserted()) return true;
    } catch (e) {
        // continue to next attempt if insertText fails
    }

    // Try 0b: use execCommand('insertHTML') as an alternative fallback for contenteditable editors
    try {
        el.focus();
        // Insert raw HTML; many rich-text editors treat this similarly to a user paste/typing
        const okHtml = document.execCommand && document.execCommand('insertHTML', false, text);
        dispatchInputEvents(el);
        await sleep(120);
        if (isInserted()) return true;
    } catch (e) {
        // ignore and proceed
    }

    // Try 0c: simulate user replacing content via clipboard + selectAll + paste sequence
    try {
        // Copy translation to clipboard (again, in case earlier writes failed)
        try {
            await navigator.clipboard.writeText(text);
        } catch (_) {}
        el.focus();
        // Select all content inside the editor via execCommand
        try {
            document.execCommand && document.execCommand('selectAll');
        } catch (_) {}
        // Issue a paste via execCommand to replace the selection with clipboard data
        try {
            document.execCommand && document.execCommand('paste');
        } catch (_) {}
        dispatchInputEvents(el);
        await sleep(200);
        if (isInserted()) return true;
    } catch (e) {
        // continue to next attempts if this fails
    }

    // Try 1: dispatch synthetic paste event with DataTransfer
    try {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        let pasteEv;
        try {
            pasteEv = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
        } catch (err) {
            // Some browsers may not allow constructing ClipboardEvent with clipboardData
            pasteEv = document.createEvent('Event');
            pasteEv.initEvent('paste', true, true);
            pasteEv.clipboardData = dt;
        }
        // Dispatch to element
        el.focus();
        const defaultNotPrevented = el.dispatchEvent(pasteEv);
        await sleep(140);
        if (isInserted()) return true;
    } catch (e) {
        // continue to next attempt
    }

    // Try 2: document.execCommand('paste') — works with user gesture in many browsers
    try {
        el.focus();
        const ok = document.execCommand && document.execCommand('paste');
        await sleep(140);
        if (isInserted()) return true;
    } catch (e) {
        // continue
    }

    // Try 3: manual insert at caret (should replace selection/contents we've cleared)
    try {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            const r = sel.getRangeAt(0);
            r.deleteContents();
            const node = document.createTextNode(text);
            r.insertNode(node);
            // move caret after inserted node
            r.setStartAfter(node);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
        } else {
            // fallback: replace innerText
            el.innerText = text;
        }
        dispatchInputEvents(el);
        await sleep(80);
        if (isInserted()) return true;
    } catch (e) {
        // continue
    }

    // Last resort: set innerText again
    try {
        el.innerText = text;
        dispatchInputEvents(el);
        await sleep(60);
        if (isInserted()) return true;
    } catch (e) {
        // ignore
    }

    return false;
}

async function handleTranslate(activeEl) {
    const selection = (window.getSelection && window.getSelection().toString && window.getSelection().toString().trim()) || "";
    let target = null;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        target = activeEl;
    } else {
        target = findEditableAncestor(activeEl) || (activeEl && activeEl.isContentEditable ? activeEl : null);
    }

    if (!target && !selection) {
        showTooltip(document.body, "Không tìm thấy chỗ nhập liệu để dịch");
        return;
    }

    const originalText = selection || (target ? (target.value !== undefined ? target.value : target.innerText) : "");
    if (!originalText || !originalText.trim()) {
        showTooltip(target || document.body, "Không có văn bản để dịch");
        return;
    }

    showTooltip(target || document.body, "Đang dịch...");
    try {
        const translated = await translateText(originalText);
        // If input/textarea, direct replace
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
            target.value = translated;
            dispatchInputEvents(target);
            showTooltip(target, "✅ Đã dịch");
            return;
        }

        // If contenteditable, try robust paste sequence
        if (target && target.isContentEditable) {
            const success = await attemptPasteSequence(target, translated);
            if (success) {
                showTooltip(target, "✅ Đã dịch");
                return;
            } else {
                // fallback: set innerText and dispatch events
                try {
                    target.innerText = translated;
                    dispatchInputEvents(target);
                    // wait a bit to see if editor accepts it
                    await sleep(120);
                    if (!(target.innerText || "").includes(translated)) {
                        // give up: copy to clipboard and notify user
                        try { await navigator.clipboard.writeText(translated); } catch(e){}
                        showTooltip(document.body, "Đã dịch — (paste bị chặn). Kết quả đã copy vào clipboard");
                    } else {
                        showTooltip(target, "✅ Đã dịch");
                    }
                    return;
                } catch (e) {}
            }
        }

        // No target but selection — copy to clipboard
        await navigator.clipboard.writeText(translated);
        showTooltip(document.body, "Đã dịch — nội dung được copy vào clipboard");
    } catch (err) {
        console.error(err);
        // If API key isn't configured, notify user to set it in options page
        if (err && err.message && err.message.includes('API key not configured')) {
            showTooltip(target || document.body, "⚠️ Chưa cấu hình API key. Vào trang tùy chọn extension để nhập API key.");
        } else {
            showTooltip(target || document.body, "❌ Lỗi dịch");
        }
    }
}

// Listen for single Alt press. Use debounce to avoid duplicates.
document.addEventListener("keydown", (e) => {
    if (e.key === ' ' && e.ctrlKey) {
        const now = Date.now();
        if (now - _lastTranslateAt < _DEBOUNCE_MS) return;
        _lastTranslateAt = now;
        // small delay so activeElement is correct
        setTimeout(() => handleTranslate(document.activeElement), 10);
    }
});
