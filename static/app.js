const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const markdownPreview = document.getElementById('markdown-preview');
const contextFilesInput = document.getElementById('context-files');

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
}
loadHistory();

// Handle chat form submission
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = userInput.value.trim();
  if (!message) return;
  renderMessage('user', message);
  userInput.value = '';
  markdownPreview.innerHTML = '';

  // Prepare form data
  const formData = new FormData();
  formData.append('message', message);
  // Append files
  if (contextFilesInput.files.length > 0) {
    for (let i = 0; i < contextFilesInput.files.length; i++) {
      formData.append('context_files', contextFilesInput.files[i]);
    }
  }

  const res = await fetch('/chat', {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  // Pass raw markdown for system message
  renderMessage('system', data.response, data.response);
});