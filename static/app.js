const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const markdownPreview = document.getElementById('markdown-preview');
const contextFilesInput = document.getElementById('context-files');
const fileDropZone = document.getElementById('file-drop-zone');
const fileDropText = document.getElementById('file-drop-text');
const fileSelectBtn = document.getElementById('file-select-btn');
const fileList = document.getElementById('file-list');

let droppedFiles = [];
let hasSavedChat = true; // Default to true when chat loads

// Live Markdown preview for user input
userInput.addEventListener('input', () => {
  markdownPreview.innerHTML = marked.parse(userInput.value, {
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
  // Highlight code blocks in preview
  if (window.hljs) {
    markdownPreview.querySelectorAll('pre code').forEach(block => {
      hljs.highlightElement(block);
    });
  }
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
fileSelectBtn.addEventListener('click', () => contextFilesInput.click());

// Handle manual file selection
contextFilesInput.addEventListener('change', (e) => {
  droppedFiles = Array.from(contextFilesInput.files);
  updateFileList();
});

// Drag events
['dragenter', 'dragover'].forEach(eventName => {
  fileDropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileDropZone.classList.add('dragover');
    fileDropText.textContent = "Drop files here!";
  });
});

['dragleave', 'drop'].forEach(eventName => {
  fileDropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileDropZone.classList.remove('dragover');
    fileDropText.innerHTML = 'Drag & drop files here, or <button type="button" id="file-select-btn">browse</button>';
    // Re-attach click event to the new button
    document.getElementById('file-select-btn').addEventListener('click', () => contextFilesInput.click());
  });
});

// Handle file drop
fileDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  const files = Array.from(e.dataTransfer.files);
  droppedFiles = droppedFiles.concat(files);
  // Remove duplicates by name/size/type
  droppedFiles = Array.from(new Map(droppedFiles.map(f => [f.name + f.size + f.type, f])).values());
  updateFileList();
});

// Show selected files
function updateFileList() {
  fileList.innerHTML = '';
  if (droppedFiles.length === 0) return;
  droppedFiles.forEach((file, idx) => {
    const div = document.createElement('div');
    div.textContent = file.name;
    // Add remove button
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.className = 'remove-file-btn';
    removeBtn.addEventListener('click', () => {
      droppedFiles.splice(idx, 1);
      updateFileList();
    });
    div.appendChild(removeBtn);
    fileList.appendChild(div);
  });
}

// Handle chat form submission
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = userInput.value.trim();
  if (!message) return;
  renderMessage('user', message);
  userInput.value = '';
  markdownPreview.innerHTML = '';

  const formData = new FormData();
  formData.append('message', message);
  droppedFiles.forEach(file => formData.append('context_files', file));

  const res = await fetch('/chat', {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  renderMessage('system', data.response, data.response);

  // Reset files after send
  droppedFiles = [];
  contextFilesInput.value = '';
  updateFileList();
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
  droppedFiles = [];
  contextFilesInput.value = '';
  updateFileList();
  hasSavedChat = true;
  // Tell the backend to reset its session
  await fetch('/reset_session', { method: 'POST' });
  // Reload new (empty) history from backend, which should be a fresh chat
  loadHistory();
});
