const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const markdownPreview = document.getElementById('markdown-preview');
const uploadFilesInput = document.getElementById('upload-files');
const uploadDropZone = document.getElementById('upload-drop-zone');
const uploadDropText = document.getElementById('upload-drop-text');
const uploadSelectBtn = document.getElementById('upload-select-btn');
const uploadList = document.getElementById('upload-list');

let selectedFiles = [];
let hasSavedChat = true; // Default to true when chat loads

function ready(fn) {
  if (document.readyState !== 'loading') {
    setTimeout(fn, 0);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(fn, 0);
    });
  }
}

ready(() => {
  // Live Markdown preview for user input
  userInput.addEventListener('input', () => {
    markdownPreview.innerHTML = marked.parse(userInput.value, {
      highlight: function() {
        return hljs.highlightAll();
      }
    });
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
      });
      div.appendChild(removeBtn);
      uploadList.appendChild(div);
    });
  }

  // Sending files in the chat form
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
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
});
