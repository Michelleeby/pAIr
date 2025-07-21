// head.js

function ready(fn) {
    if (document.readyState !== 'loading') {
      setTimeout(fn, 0); // wait until the next event loop iteration.
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(fn, 0);
      });
    }
}
  
function setTheme(dark) {
  document.getElementById('github-markdown-theme').href = dark
    ? 'https://cdn.jsdelivr.net/npm/github-markdown-css@5.5.1/github-markdown-dark.min.css'
    : 'https://cdn.jsdelivr.net/npm/github-markdown-css@5.5.1/github-markdown-light.min.css';
  document.getElementById('highlightjs-theme').href = dark
    ? 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.min.css'
    : 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css';
  document.body.classList.toggle('dark', dark);
}

function __doSetTheme() {
    setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => setTheme(e.matches));
}

ready(__doSetTheme);