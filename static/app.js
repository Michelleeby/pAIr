// =============================
// Constants
// =============================
const DEBOUNCE_DELAY = 300;
const TOKEN_LIMIT = 1000000;

// =============================
// DOM Elements
// =============================
const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const markdownPreview = document.getElementById('markdown-preview');
const uploadFilesInput = document.getElementById('upload-files');
const uploadDropZone = document.getElementById('upload-drop-zone');
const uploadDropText = document.getElementById('upload-drop-text');
const uploadSelectBtn = document.getElementById('upload-select-btn');
const uploadList = document.getElementById('upload-list');
const tokenStatsBar = document.createElement('div');
tokenStatsBar.className = 'token-stats-bar';
chatForm.insertBefore(tokenStatsBar, chatForm.firstChild);

// =============================
// State Store
// =============================
const appState = (() => {
  const initialState = {
    selectedFiles: [],
    hasSavedChat: true,
    filesTokenCounts: [],
    promptTokenCount: 0,
    chatHistoryTokenCount: 0,
    totalTokenCount: 0,
    tokenLimit: TOKEN_LIMIT,
    tokenCountsLoading: false,
    frontendTokenizer: null,
    modelLoadingPromise: null,
  };

  let state = { ...initialState };
  const listeners = new Set();

  function recomputeDerived(nextState) {
    // Sanity: always compute the sum.
    nextState.totalTokenCount =
      (nextState.promptTokenCount || 0) +
      (nextState.filesTokenCounts
        ? nextState.filesTokenCounts.reduce((sum, f) => sum + (f.token_count || 0), 0)
        : 0) +
      (nextState.chatHistoryTokenCount || 0);

    // if other derived values, recalc here too
  }

  return {
    get: () => ({ ...state }),
    set: (updates) => {
      // Merge the updates first
      const nextState = { ...state, ...updates };
      recomputeDerived(nextState);         // <--- always recalculate
      state = nextState;
      listeners.forEach(fn => fn(state));
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    reset: () => {
      state = { ...initialState };
      listeners.forEach(fn => fn(state));
    }
  };
})();

// =============================
// "ready" - Top Level Execution
// =============================

ready(() => {
  initializeTokenizer();
  initializeTokenStatsBar();
  setupFileInputs();
  setupMarkdownPreview();
  setupChatForm();
  setupSaveAndNewChatButtons();
  initializeAppState();

  appState.subscribe(state => {
    renderTokenStatsBar(state);
    updateUploadList(state);
    updateSendButtonState(state);
  });
});

// ====================
// Function Definitions
// ====================

function initializeTokenizer() {
  ensureFrontendTokenizer().then(tok => appState.set({ frontendTokenizer: tok }));
}

// Initialize and cache the tokenizer
async function ensureFrontendTokenizer() {
  if (appState.get().frontendTokenizer) return appState.get().frontendTokenizer;
  if (!appState.get().modelLoadingPromise) {
    appState.set({ modelLoadingPromise: FrontendBPETokenizer.loadModel()
      .then(model => appState.set({ frontendTokenizer: new FrontendBPETokenizer(model) }))
    });
  }
  await appState.get().modelLoadingPromise;
  return appState.get().frontendTokenizer;
}

// Count tokens locally
async function fastLocalTokenCount(text) {
  if (!text) return 0;
  return appState.get().frontendTokenizer.encode(text).length;
}

/**
 * Sets up the global token stats bar in the chat form.
 */
function initializeTokenStatsBar() {
  tokenStatsBar.className = 'token-stats-bar';
  chatForm.insertBefore(tokenStatsBar, chatForm.firstChild);
}

/**
 * Updates counts (debounced).
 */
function onContextFilesChanged() {
  setTokenGroupCountsDebounced('context_files');
}

function onUserInputChanged() {
  setTokenGroupCountsDebounced('user_input');
}

/**
 * Converts chat history to a Markdown string.
 */
function chatHistoryToMarkdown() {
  let md = '';
  chatHistory.querySelectorAll('.message').forEach(div => {
    if (div.classList.contains('user')) md += '#### User\n\n';
    else md += '#### pAIr\n\n';
    let rawContent = div.querySelector('.content');
    if (rawContent) {
      let contentText = rawContent.innerText.trim();
      md += contentText + '\n\n---\n\n';
    }
  });
  return md.trim();
}

/**
 * Initiates Markdown download of chat history.
 */
function downloadChatAsMarkdown() {
  const mdText = chatHistoryToMarkdown();
  const blob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateString = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `pair-chat-${dateString}.md`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

/**
 * Loads chat history from backend on page load or new chat.
 */
async function loadChatHistory() {
  chatHistory.innerHTML = '';
  const res = await fetch('/history');
  const data = await res.json();
  data.history
    .filter(msg => msg.role === 'user' || msg.role === 'system')
    .forEach((msg, idx) => {
      if (msg.role === 'system' && idx === 0) return; // skip prompt
      renderMessage(
        msg.role === 'system' ? 'system' : 'user',
        msg.content,
        msg.role === 'system' ? msg.content : null
      );
    });
  appState.set({ hasSavedChat: false });
}

/**
 * Renders a chat message in the history area.
 */
function renderMessage(role, content, rawMarkdown = null) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;
  const contentDiv = document.createElement('div');
  contentDiv.className = 'content markdown-body';
  contentDiv.innerHTML = marked.parse(content, {
    highlight: function(code, lang) {
      if (window.hljs && lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      if (window.hljs) {
        return hljs.highlightAuto(code).value;
      }
      return code;
    }
  });

  // Copy button for system messages
  if (role === 'system') {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    const markdownToCopy = rawMarkdown || content;
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(markdownToCopy);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    });
    contentDiv.appendChild(copyBtn);
  }

  msgDiv.appendChild(contentDiv);
  chatHistory.appendChild(msgDiv);

  // Syntax highlighting
  if (window.hljs) {
    contentDiv.querySelectorAll('pre code').forEach(block => {
      hljs.highlightElement(block);
    });
  }
  // Mermaid diagrams
  if (window.mermaid && typeof window.mermaid.run === 'function') {
    contentDiv.querySelectorAll('pre code').forEach(block => {
      if (block.classList.contains('language-mermaid')) {
        window.mermaid.run({nodes: [block]});
      }
    });
  }
  // Copy button for code blocks
  contentDiv.querySelectorAll('pre code').forEach(codeBlock => {
    if (codeBlock.parentElement.querySelector('.code-copy-btn')) return;
    const codeCopyBtn = document.createElement('button');
    codeCopyBtn.className = 'code-copy-btn';
    codeCopyBtn.textContent = 'Copy code';
    codeCopyBtn.style.position = 'absolute';
    codeCopyBtn.style.top = '8px';
    codeCopyBtn.style.right = '12px';
    codeCopyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(codeBlock.innerText);
      codeCopyBtn.textContent = 'Copied!';
      setTimeout(() => (codeCopyBtn.textContent = 'Copy code'), 1200);
    });
    codeBlock.parentElement.style.position = 'relative';
    codeBlock.parentElement.appendChild(codeCopyBtn);
  });

  chatHistory.scrollTop = chatHistory.scrollHeight;
  appState.set({ hasSavedChat: false });
}

/**
 * Updates the file upload list UI.
 */
function updateUploadList(state) {
  uploadList.innerHTML = '';
  if (state.selectedFiles.length === 0) return;
  state.selectedFiles.forEach((file, idx) => {
    const div = document.createElement('div');
    const icon = file.type.startsWith('image/') ? '🖼️' : '📄';
    div.innerHTML = `${icon}&nbsp;${file.name}`;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.className = 'remove-file-btn';
    removeBtn.addEventListener('click', () => {
      state.selectedFiles.splice(idx, 1);
      updateUploadList(state);
      onContextFilesChanged(state);
    });
    div.appendChild(removeBtn);
    uploadList.appendChild(div);
  });
}

/**
 * Adds files to context, avoiding duplicates.
 */
function addFiles(files) {
  for (const f of files) {
    if (!appState.get().selectedFiles.some(existing => existing.name === f.name && existing.size === f.size && existing.type === f.type)) {
      appState.get().selectedFiles.push(f);
    }
  }
}

/**
 * Sets up file input listeners (manual + drag/drop).
 */
function setupFileInputs() {
  uploadSelectBtn.addEventListener('click', () => uploadFilesInput.click());
  uploadFilesInput.addEventListener('change', (e) => {
    addFiles(Array.from(uploadFilesInput.files));
    uploadFilesInput.value = '';
    onContextFilesChanged(appState.get());
  });
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadDropZone.addEventListener(eventName, (e) => {
      e.preventDefault(); e.stopPropagation();
      uploadDropZone.classList.add('dragover');
      uploadDropText.textContent = "Drop files or images here!";
    });
  });
  ['dragleave', 'drop'].forEach(eventName => {
    uploadDropZone.addEventListener(eventName, (e) => {
      e.preventDefault(); e.stopPropagation();
      uploadDropZone.classList.remove('dragover');
      uploadDropText.innerHTML = 'Drag & drop files or images here, or <button type="button" id="upload-select-btn">browse</button>';
      document.getElementById('upload-select-btn').addEventListener('click', () => uploadFilesInput.click());
    });
  });
  uploadDropZone.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    addFiles(Array.from(e.dataTransfer.files));
    onContextFilesChanged(appState.get());
  });
}

/**
 * Sets up event handlers for Markdown live preview.
 */
function setupMarkdownPreview() {
  userInput.addEventListener('input', () => {
    markdownPreview.innerHTML = marked.parse(userInput.value);
    if (window.hljs) {
      markdownPreview.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    }
    if (window.mermaid && typeof window.mermaid.run === 'function') {
      markdownPreview.querySelectorAll('pre code').forEach(block => {
        if (block.classList.contains('language-mermaid')) {
          window.mermaid.run({nodes: [block]});
        }
      });
    }
    onUserInputChanged(appState.get());
  });
}

/**
 * Enables chat submission and logic for new chat/reset.
 */
function setupChatForm() {
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (appState.get().tokenCountsLoading) {
      alert('Token counting in progress — please wait.');
      return;
    }
    if (appState.get().totalTokenCount > appState.get().tokenLimit) {
      showOverLimitModal();
      return;
    }
    const message = userInput.value.trim();
    if (!message) return;
    renderMessage('user', message);
    userInput.value = '';
    markdownPreview.innerHTML = '';

    const processingDiv = document.createElement('div');
    processingDiv.className = 'processing-message';
    processingDiv.innerHTML = `
      <span class="processing-ellipsis">
        <span></span><span></span><span></span>
      </span>
      <span>pAIr is processing your request...</span>
    `;
    chatHistory.appendChild(processingDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    const formData = new FormData();
    formData.append('message', message);

    appState.get().selectedFiles.forEach(file => {
      if (file.type && file.type.startsWith('image/')) formData.append('images', file);
      else formData.append('context_files', file);
    });

    const enableWebSearch = document.getElementById('enable-web-search').checked;
    const webSearchParams = document.getElementById('web-search-params').value.trim();
    let webSearchOptions = null;
    if (enableWebSearch) {
      try { webSearchOptions = webSearchParams ? JSON.parse(webSearchParams) : {}; }
      catch (e) { alert("Invalid web search options JSON."); return; }
    }
    if (webSearchOptions !== null) {
      formData.append('web_search_options', JSON.stringify(webSearchOptions));
    }

    const res = await fetch('/chat', { method: 'POST', body: formData });
    const data = await res.json();
    if (processingDiv.parentNode) processingDiv.parentNode.removeChild(processingDiv);
    renderMessage('system', data.response, data.response);
    appState.set({ selectedFiles: [] });
    uploadFilesInput.value = '';
    setTokenGroupsCounts();
  });
}

/**
 * Enables the "Save Chat" and "New Chat" buttons.
 */
function setupSaveAndNewChatButtons() {
  document.getElementById('save-chat-btn').addEventListener('click', () => {
    downloadChatAsMarkdown();
    appState.set({ hasSavedChat: true });
  });

  document.getElementById('new-chat-btn').addEventListener('click', async () => {
    if (!appState.get().hasSavedChat) {
      if (confirm("You have unsaved chat history. Would you like to save before starting a new chat?")) {
        downloadChatAsMarkdown();
        appState.set({ hasSavedChat: true });
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    chatHistory.innerHTML = '';
    userInput.value = '';
    markdownPreview.innerHTML = '';
    appState.set({ selectedFiles: [] });
    uploadFilesInput.value = '';
    appState.set({ hasSavedChat: true });
    await fetch('/reset_session', { method: 'POST' });
    loadChatHistory();
  });
}

/**
 * Reads a file as text.
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * Updates the token count for a specific group.
 */
async function setTokenGroupCounts(tokenGroup) {
  if (tokenGroup === 'context_files') {
    const counts = await Promise.all(
      appState.get().selectedFiles
        .filter(f => !f.type.startsWith('image/'))
        .map(async (f) => {
          const content = await readFileAsText(f);
          const tokenCount = await fastLocalTokenCount(content);
          return {
            filename: f.name,
            token_count: tokenCount
          };
        })
    );
      appState.set({ filesTokenCounts: counts });
  } else if (tokenGroup === 'user_input') {
    appState.set({ promptTokenCount: await fastLocalTokenCount(userInput.value.trim()) });
  } else if (tokenGroup === 'chat_history') {
    const history = await fetch('/history').then(r => r.json());
    appState.set({ chatHistoryTokenCount: history.history.reduce((sum, msg) => sum + (msg.tokens || 0), 0) });
  } else {
    throw new Error(`Invalid token group: ${tokenGroup}`);
  }
}

/**
 * Updates the token counts for all groups.
 */
async function setTokenGroupsCounts() {
  await setTokenGroupCounts('context_files');
  await setTokenGroupCounts('user_input');
  await setTokenGroupCounts('chat_history');
}

/**
 * Updates the token stats bar's HTML based on current state.
 */
function renderTokenStatsBar(state) {
  const { promptTokenCount, filesTokenCounts, chatHistoryTokenCount, totalTokenCount, tokenLimit } = state;
  if (state.error) {
    tokenStatsBar.innerHTML = `<span style="color:red;">${state.error}</span>`;
    return;
  }
  if (state.tokenCountsLoading) {
    tokenStatsBar.innerHTML = `<em>Counting tokens&nbsp;<span class="token-spinner"></span></em>`;
    return;
  }
  let html = '';
  html += `<strong>Tokens:</strong> `;
  html += `<span title="Prompt">${promptTokenCount} (prompt)</span> + `;
  html += filesTokenCounts.map(
      f => `<span title="${f.filename}">${f.token_count} <code>${escapeHtml(f.filename)}</code></span>`
  ).join(' + ') || '0 (context)';
  html += chatHistoryTokenCount ? ` + <span title="Chat history">${chatHistoryTokenCount} (history)</span>` : '';
  html += ` = <strong>${totalTokenCount}</strong> / ${tokenLimit}`;
  if (totalTokenCount > tokenLimit) {
    html += ' <span style="color:red">⚠️ Over limit</span>';
  }
  tokenStatsBar.innerHTML = html;
}

/**
 * Enables or disables send button based on token count and loading status.
 */
function updateSendButtonState(state) {
  const sendBtn = chatForm.querySelector('button[type="submit"]');
  sendBtn.disabled = state.tokenCountsLoading || state.totalTokenCount > state.tokenLimit;
  sendBtn.style.opacity = sendBtn.disabled ? 0.5 : 1;
}

/**
 * Shows over-limit modal dialog and handles actions.
 */
function showOverLimitModal() {
  const modal = document.createElement('div');
  modal.className = 'token-modal';
  modal.innerHTML = `
    <div class="token-modal-content">
      <h3>Token Limit Exceeded</h3>
      <p>Your message and context exceed the maximum allowed tokens (${appState.get().tokenLimit}).</p>
      <ul>
        <li>Remove one or more context files, or</li>
        <li>
          <button type="button" id="trim-history-btn">Let pAIr trim old conversation (auto)</button>
        </li>
      </ul>
      <button id="close-token-modal" class="icon-btn">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('trim-history-btn').onclick = async function() {
    modal.remove();
    sendWithHistoryTrim();
  };
  document.getElementById('close-token-modal').onclick = function() {
    modal.remove();
  };
}

/**
 * Sends prompt form contents while signaling backend to trim chat history.
 */
async function sendWithHistoryTrim() {
  const message = userInput.value.trim();
  if (!message) return;
  renderMessage('user', message);
  userInput.value = '';
  markdownPreview.innerHTML = '';

  const processingDiv = document.createElement('div');
  processingDiv.className = 'processing-message';
  processingDiv.innerHTML = `
    <span class="processing-ellipsis">
      <span></span><span></span><span></span>
    </span>
    <span>Trimming old conversation to fit token limit…</span>
  `;
  chatHistory.appendChild(processingDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  const formData = new FormData();
  formData.append('message', message);
  appState.get().selectedFiles.forEach(file => {
    if (file.type.startsWith('image/')) formData.append('images', file);
    else formData.append('context_files', file);
  });

  const enableWebSearch = document.getElementById('enable-web-search').checked;
  const webSearchParams = document.getElementById('web-search-params').value.trim();
  let webSearchOptions = null;
  if (enableWebSearch) {
    try { webSearchOptions = webSearchParams ? JSON.parse(webSearchParams) : {}; }
    catch (e) { alert("Invalid web search options JSON."); return; }
  }
  if (webSearchOptions !== null) {
    formData.append('web_search_options', JSON.stringify(webSearchOptions));
  }

  formData.append('trim_history', 'true');

  const res = await fetch('/chat', { method: 'POST', body: formData });
  const data = await res.json();
  if (processingDiv.parentNode) processingDiv.parentNode.removeChild(processingDiv);

  if (data.error) {
    renderMessage('system', `❗️ Token limit still exceeded; could not send.`);
  } else {
    renderMessage('system', data.response, data.response);
  }

  appState.set({ selectedFiles: [] });
  uploadFilesInput.value = '';
}

/**
 * Attach the Markdown download/preview/save handlers, and "new chat" logic.
 */

/**
 * Initializes the app state by updating counts & loading history.
 */
function initializeAppState() {
  setTokenGroupsCounts();
  loadChatHistory();
}

/**
 * Debounced version of updateTokenGroup for input/file changes.
 */
const setTokenGroupCountsDebounced = debounce(setTokenGroupCounts, DEBOUNCE_DELAY);