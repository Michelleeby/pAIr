const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const markdownPreview = document.getElementById('markdown-preview');
const contextFilesInput = document.getElementById('context-files');

// Live Markdown preview for user input
userInput.addEventListener('input', () => {
  markdownPreview.innerHTML = marked.parse(userInput.value);
});

// Render a message in the chat history
function renderMessage(role, content) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;
  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';
  contentDiv.innerHTML = marked.parse(content);
  msgDiv.appendChild(contentDiv);
  chatHistory.appendChild(msgDiv);
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
      renderMessage(msg.role === 'system' ? 'system' : 'user', msg.content);
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
  renderMessage('system', data.response);
});