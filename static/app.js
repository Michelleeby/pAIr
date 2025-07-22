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

let selectedFiles = [];
let hasSavedChat = true;            // Default to true when chat loads
let filesTokenCounts = [];          // {filename, token_count}
let promptTokenCount = 0;
let chatHistoryTokenCount = 0;
let totalTokenCount = 0;
let tokenLimit = 1000000;           // Will be updated by backend on first response
let tokenCountsLoading = false;
let lastTokenCountPayload = null;   // For debounce/input dedupe
let tokenCountRequestId = 0;        // To sync async responses and ignore race conditions


/**
 * Get token count for a string or files from backend.
 * @param {Object} opts = {text: string, files: File[]}
 * @returns {Promise<{text_token_count?:number, files?:Array<{filename:string, token_count:number}>}>}
 */
function getTokenCounts({ text, files }) {
  const formData = new FormData();
  if (text) formData.append('text', text);
  if (files && files.length) {
    files.forEach(f => formData.append('files', f));
  }
  return fetch('/token_count', {
    method: 'POST',
    body: formData
  }).then(r => r.json());
}

// Wrap in debounce for file and input
const updateTokenCountsDebounced = debounce(updateTokenCounts, 250);

function onContextFilesChanged() {
  updateTokenCountsDebounced();
}
function onUserInputChanged() {
  updateTokenCountsDebounced();
}

async function updateTokenCounts() {
  // Only count text files, not images
  const filesToCount = selectedFiles.filter(f => !f.type.startsWith('image/'));
  const text = userInput.value.trim();

  // If nothing changes, skip (cache)
  const currentPayload = JSON.stringify({
    text: text,
    files: filesToCount.map(f => f.name + '.' + f.size + '.' + f.type), // crude signature
  });
  if (lastTokenCountPayload === currentPayload && !tokenCountsLoading) {
    return;
  }
  lastTokenCountPayload = currentPayload;

  tokenCountsLoading = true;
  renderTokenStatsBar();

  tokenCountRequestId += 1;
  const reqId = tokenCountRequestId;

  try {
    const result = await getTokenCounts({ text, files: filesToCount });
    if (reqId !== tokenCountRequestId) return; // a newer request replaced this one

    filesTokenCounts = (result.files || []).map(f => ({
      filename: f.filename,
      token_count: f.token_count || 0
    }));
    promptTokenCount = result.text_token_count || 0;

    // Fetch history count from backend (refactor needed!), or stub:
    let historyRes = await fetch('/history');
    let hist = await historyRes.json();
    chatHistoryTokenCount = 0;
    if (hist.history) {
      for (const msg of hist.history) {
        // Approximate: Only count recent messages, as backend does
        if (msg && typeof msg.content === 'string') {
          // Send only if backend will actually trim using tokens on server-side; else, just count for alert.
          chatHistoryTokenCount += (msg.tokens || 0); // backend could provide tokens, but fallback needed:
          if (!msg.tokens) {
            // If tokens field missing, you may need to ask the backend for another endpoint or include tokens in /history
            // We'll skip; could fallback to len(msg.content.split(" "))
          }
        }
      }
    }

    // If /history does not return tokens, you may want to estimate in JS for now
    totalTokenCount = promptTokenCount +
      filesTokenCounts.reduce((sum, f) => sum + f.token_count, 0) +
      chatHistoryTokenCount;

    // Fetch token limit from backend if provided
    if (result.token_limit) {
      tokenLimit = result.token_limit;
    }

    tokenCountsLoading = false;
    renderTokenStatsBar();
    updateSendButtonState();
  } catch (err) {
    tokenCountsLoading = false;
    renderTokenStatsBar(`Failed to count tokens: ${err.message || err}`);
    updateSendButtonState();
  }
}

function renderTokenStatsBar(error) {
  if (error) {
    tokenStatsBar.innerHTML = `<span style="color:red;">${error}</span>`;
    return;
  }
  if (tokenCountsLoading) {
    tokenStatsBar.innerHTML = `<em>Counting tokens&nbsp;<span class="token-spinner"></span></em>`;
    return;
  }
  let html = '';
  html += `<strong>Tokens:</strong> `;
  html += `<span title="Prompt">${promptTokenCount} (prompt)</span> + `;
  html += filesTokenCounts.map(
      f => `<span title="${f.filename}">${f.token_count} <code>${escapeHtml(f.filename)}</code></span>`
  ).join(' + ');
  html += chatHistoryTokenCount ? ` + <span title="Chat history">${chatHistoryTokenCount} (history)</span>` : '';
  html += ` = <strong>${totalTokenCount}</strong> / ${tokenLimit}`;
  if (totalTokenCount > tokenLimit) {
    html += ' <span style="color:red">⚠️ Over limit</span>';
  }
  tokenStatsBar.innerHTML = html;
}

function updateSendButtonState() {
  const sendBtn = chatForm.querySelector('button[type="submit"]');
  sendBtn.disabled = tokenCountsLoading || totalTokenCount > tokenLimit;
  sendBtn.style.opacity = sendBtn.disabled ? 0.5 : 1;
}

function showOverLimitModal() {
  // Dialog for user to remove files or approve history trimming
  const modal = document.createElement('div');
  modal.className = 'token-modal';
  modal.innerHTML = `
    <div class="token-modal-content">
      <h3>Token Limit Exceeded</h3>
      <p>Your message and context exceed the maximum allowed tokens (${tokenLimit}).</p>
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
async function sendWithHistoryTrim() {
  // Re-submit form, passing a "trim_history" option
  const message = userInput.value.trim();
  if (!message) return;
  renderMessage('user', message);
  userInput.value = '';
  markdownPreview.innerHTML = '';

  // Add processing message with animated ellipsis ... (as you do)
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

  selectedFiles.forEach(file => {
    if (file.type && file.type.startsWith('image/')) {
      formData.append('images', file);
    } else {
      formData.append('context_files', file);
    }
  });

  // Web search options, as before
  const enableWebSearch = document.getElementById('enable-web-search').checked;
  const webSearchParams = document.getElementById('web-search-params').value.trim();
  let webSearchOptions = null;
  if (enableWebSearch) {
    try {
      webSearchOptions = webSearchParams ? JSON.parse(webSearchParams) : {};
    } catch (e) {
      alert("Invalid web search options JSON.");
      return;
    }
  }
  if (webSearchOptions !== null) {
    formData.append('web_search_options', JSON.stringify(webSearchOptions));
  }

  // Signal backend to trim history
  formData.append('trim_history', 'true');

  const res = await fetch('/chat', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  if (processingDiv.parentNode) {
    processingDiv.parentNode.removeChild(processingDiv);
  }
  if (data.error) {
    renderMessage('system', `❗️ Token limit still exceeded; could not send.`);
  } else {
    renderMessage('system', data.response, data.response);
  }

  // Reset files and update
  selectedFiles = [];
  uploadFilesInput.value = '';
  updateUploadList();
  updateTokenCounts();  // Recount now that history was trimmed
}

function updateUploadList() {
  uploadList.innerHTML = '';
  if (selectedFiles.length === 0) return;
  selectedFiles.forEach((file, idx) => {
    const div = document.createElement('div');
    // Show a 📄 or 🖼️ for type
    const icon = file.type.startsWith('image/') ? '🖼️' : '📄';
    div.innerHTML = `${icon}&nbsp;${file.name}`;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.className = 'remove-file-btn';
    removeBtn.addEventListener('click', () => {
      selectedFiles.splice(idx, 1);
      updateUploadList();
      onContextFilesChanged();
    });
    div.appendChild(removeBtn);
    uploadList.appendChild(div);
  });
}

ready(() => {
  // Live Markdown preview for user input
  userInput.addEventListener('input', () => {
    markdownPreview.innerHTML = marked.parse(userInput.value);
    if (window.hljs) {
      // Only highlight code blocks in the preview area
      markdownPreview.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    }
    // Run mermaid after rendering
    if (window.mermaid && typeof window.mermaid.run === 'function') {
      markdownPreview.querySelectorAll('pre code').forEach(block => {
        if (block.classList.contains('language-mermaid')) {
          window.mermaid.run({nodes: [block]});
        }
      });
    }
    onUserInputChanged();
  });

  // Convert chat history to Markdown string
  function chatHistoryToMarkdown() {
    let md = '';
    chatHistory.querySelectorAll('.message').forEach(div => {
      if (div.classList.contains('user')) {
        md += '#### User\n\n';
      } else {
        md += '#### pAIr\n\n';
      }
      // Extract plain markdown from the original source if available, else fallback to innerText
      let rawContent = div.querySelector('.content');
      if (rawContent) {
        let contentText = rawContent.innerText.trim();
        md += contentText + '\n\n---\n\n';
      }
    });
    return md.trim();
  }

  // Initiates download (.md file)
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

  // Render a message in the chat history
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

    // Add copy button for system messages (AI responses)
    if (role === 'system') {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = 'Copy';
      // Use rawMarkdown if provided, else fallback to content
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

    // Highlight code blocks after rendering
    if (window.hljs) {
      contentDiv.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
      });
    }

    // Run mermaid after rendering
    if (window.mermaid && typeof window.mermaid.run === 'function') {
      contentDiv.querySelectorAll('pre code').forEach(block => {
        if (block.classList.contains('language-mermaid')) {
          window.mermaid.run({nodes: [block]});
        }
      });
    }

    // Add copy button to each code block
    contentDiv.querySelectorAll('pre code').forEach(codeBlock => {
      // Avoid duplicate buttons
      if (codeBlock.parentElement.querySelector('.code-copy-btn')) return;
      const codeCopyBtn = document.createElement('button');
      codeCopyBtn.className = 'code-copy-btn';
      codeCopyBtn.textContent = 'Copy code';
      codeCopyBtn.style.position = 'absolute';
      codeCopyBtn.style.top = '8px';
      codeCopyBtn.style.right = '12px';
      codeCopyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Only copy the code, not the fences
        navigator.clipboard.writeText(codeBlock.innerText);
        codeCopyBtn.textContent = 'Copied!';
        setTimeout(() => (codeCopyBtn.textContent = 'Copy code'), 1200);
      });
      // Position the button inside the <pre>
      codeBlock.parentElement.style.position = 'relative';
      codeBlock.parentElement.appendChild(codeCopyBtn);
    });

    chatHistory.scrollTop = chatHistory.scrollHeight;
    hasSavedChat = false;
  }

  // Load chat history on page load
  async function loadHistory() {
    chatHistory.innerHTML = '';
    const res = await fetch('/history');
    const data = await res.json();
    data.history
      .filter(msg => msg.role === 'user' || msg.role === 'system') // Only user and bot
      .forEach((msg, idx) => {
        // Skip the first system message (system prompt)
        if (msg.role === 'system' && idx === 0) return;
        // Do not show context or system prompt
        // Pass raw markdown for system messages
        renderMessage(msg.role === 'system' ? 'system' : 'user', msg.content, msg.role === 'system' ? msg.content : null);
      });
    hasSavedChat = false;
  }
  loadHistory();

  // Open file dialog on button click
  uploadSelectBtn.addEventListener('click', () => uploadFilesInput.click());

  // Manual file selection
  uploadFilesInput.addEventListener('change', (e) => {
    addFiles(Array.from(uploadFilesInput.files));
    uploadFilesInput.value = '';
    onContextFilesChanged();
  });

  // Drag events
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadDropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadDropZone.classList.add('dragover');
      uploadDropText.textContent = "Drop files or images here!";
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadDropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadDropZone.classList.remove('dragover');
      uploadDropText.innerHTML = 'Drag & drop files or images here, or <button type="button" id="upload-select-btn">browse</button>';
      // Re-attach event to button (HTML was replaced)
      document.getElementById('upload-select-btn').addEventListener('click', () => uploadFilesInput.click());
    });
  });

  // Handle drop event
  uploadDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    addFiles(Array.from(e.dataTransfer.files));
    onContextFilesChanged();
  });

  // Add files, prevent duplicates
  function addFiles(files) {
    for (const f of files) {
      if (!selectedFiles.some(existing => existing.name === f.name && existing.size === f.size && existing.type === f.type)) {
        selectedFiles.push(f);
      }
    }
    updateUploadList();
  }

  // Sending files in the chat form
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (tokenCountsLoading) {
      alert('Token counting in progress — please wait.');
      return;
    }
    if (totalTokenCount > tokenLimit) {
      showOverLimitModal();
      return;
    }
    const message = userInput.value.trim();
    if (!message) return;
    renderMessage('user', message);
    userInput.value = '';
    markdownPreview.innerHTML = '';

    // Add processing message with animated ellipsis
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

    // Split files by type (hidden from user)
    selectedFiles.forEach(file => {
      if (file.type && file.type.startsWith('image/')) {
        formData.append('images', file);
      } else {
        formData.append('context_files', file);
      }
    });

    // Web search options
    const enableWebSearch = document.getElementById('enable-web-search').checked;
    const webSearchParams = document.getElementById('web-search-params').value.trim();
    let webSearchOptions = null;
    if (enableWebSearch) {
      try {
        webSearchOptions = webSearchParams ? JSON.parse(webSearchParams) : {};
      } catch (e) {
        alert("Invalid web search options JSON.");
        return;
      }
    }
    if (webSearchOptions !== null) {
      formData.append('web_search_options', JSON.stringify(webSearchOptions));
    }

    const res = await fetch('/chat', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    // Remove the processing message
    if (processingDiv.parentNode) {
      processingDiv.parentNode.removeChild(processingDiv);
    }

    renderMessage('system', data.response, data.response);

    // Reset files after send
    selectedFiles = [];
    uploadFilesInput.value = '';
    updateUploadList();
  });

  // Save Chat Button
  document.getElementById('save-chat-btn').addEventListener('click', () => {
    downloadChatAsMarkdown();
    hasSavedChat = true;
  });

  // Start New Chat Button
  document.getElementById('new-chat-btn').addEventListener('click', async () => {
    if (!hasSavedChat) {
      if (confirm("You have unsaved chat history. Would you like to save before starting a new chat?")) {
        downloadChatAsMarkdown();
        hasSavedChat = true;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    // Clear the chat history visually and reset files
    chatHistory.innerHTML = '';
    userInput.value = '';
    markdownPreview.innerHTML = '';
    selectedFiles = [];
    uploadFilesInput.value = '';
    updateUploadList();
    hasSavedChat = true;
    // Tell the backend to reset its session
    await fetch('/reset_session', { method: 'POST' });
    // Reload new (empty) history from backend, which should be a fresh chat
    loadHistory();
  });

  function renderTokenStatsBar(error) {
    if (error) {
      tokenStatsBar.innerHTML = `<span style="color:red;">${error}</span>`;
      return;
    }
    if (tokenCountsLoading) {
      tokenStatsBar.innerHTML = `<em>Counting tokens&nbsp;<span class="token-spinner"></span></em>`;
      return;
    }
    let html = '';
    html += `<strong>Tokens:</strong> `;
    html += `<span title="Prompt">${promptTokenCount} (prompt)</span> + `;
    html += filesTokenCounts.map(
        f => `<span title="${f.filename}">${f.token_count} <code>${escapeHtml(f.filename)}</code></span>`
    ).join(' + ');
    html += chatHistoryTokenCount ? ` + <span title="Chat history">${chatHistoryTokenCount} (history)</span>` : '';
    html += ` = <strong>${totalTokenCount}</strong> / ${tokenLimit}`;
    if (totalTokenCount > tokenLimit) {
      html += ' <span style="color:red">⚠️ Over limit</span>';
    }
    tokenStatsBar.innerHTML = html;
  }

  updateTokenCounts();
});
