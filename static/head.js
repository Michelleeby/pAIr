// head.js

/**
 * @param {Function} fn
 * @description
 * This function is used to ensure that the provided function is executed after the DOM is fully loaded.
 */
function ready(fn) {
    if (document.readyState !== 'loading') {
      setTimeout(fn, 0); // wait until the next event loop iteration.
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(fn, 0);
      });
    }
}
  
/**
 * @param {boolean} dark
 * @description
 * This function is used to set the theme of the page, based on the dark mode system preference.
 */
function setTheme(dark) {
  document.getElementById('github-markdown-theme').href = dark
    ? 'https://cdn.jsdelivr.net/npm/github-markdown-css@5.5.1/github-markdown-dark.min.css'
    : 'https://cdn.jsdelivr.net/npm/github-markdown-css@5.5.1/github-markdown-light.min.css';
  document.getElementById('highlightjs-theme').href = dark
    ? 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.min.css'
    : 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css';
  document.body.classList.toggle('dark', dark);
}

/**
 * @description
 * This function is used to change the theme of the page.
 */
function __doSetTheme() {
    setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => setTheme(e.matches));
}

ready(__doSetTheme);