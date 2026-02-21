document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save-settings-btn').addEventListener('click', saveOptions);
document.getElementById('add-prompt-btn').addEventListener('click', addPrompt);

let prompts = [];

const DEFAULT_IGNORE_TAGS = "script, style, noscript, header, footer, nav, iframe, svg";

function restoreOptions() {
  chrome.storage.local.get({
    ollamaHost: 'http://localhost:11434',
    ollamaModel: 'llama3',
    ignoreTags: DEFAULT_IGNORE_TAGS,
    ignoreSelectors: '',
    prompts: [],
    defaultPromptId: null
  }, function(items) {
    document.getElementById('ollama-host').value = items.ollamaHost;
    document.getElementById('ollama-model').value = items.ollamaModel;
    document.getElementById('ignore-tags').value = Array.isArray(items.ignoreTags) ? items.ignoreTags.join(', ') : items.ignoreTags;
    document.getElementById('ignore-selectors').value = Array.isArray(items.ignoreSelectors) ? items.ignoreSelectors.join(', ') : items.ignoreSelectors;
    
    prompts = items.prompts;
    renderPrompts(items.defaultPromptId);
  });
}

function saveOptions() {
  const host = document.getElementById('ollama-host').value;
  const model = document.getElementById('ollama-model').value;
  const ignoreTags = document.getElementById('ignore-tags').value.split(',').map(s => s.trim()).filter(Boolean);
  const ignoreSelectors = document.getElementById('ignore-selectors').value.split(',').map(s => s.trim()).filter(Boolean);
  
  // Find selected default
  const selectedRadio = document.querySelector('input[name="default-prompt"]:checked');
  const defaultPromptId = selectedRadio ? selectedRadio.value : null;

  chrome.storage.local.set({
    ollamaHost: host,
    ollamaModel: model,
    ignoreTags: ignoreTags,
    ignoreSelectors: ignoreSelectors,
    prompts: prompts,
    defaultPromptId: defaultPromptId
  }, function() {
    const status = document.getElementById('status-msg');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 2000);
  });
}

function addPrompt() {
  const title = document.getElementById('new-prompt-title').value.trim();
  const content = document.getElementById('new-prompt-content').value.trim();
  
  if (!title || !content) {
    alert('Title and Content are required.');
    return;
  }
  
  const id = Date.now().toString();
  prompts.push({ id, title, content });
  
  document.getElementById('new-prompt-title').value = '';
  document.getElementById('new-prompt-content').value = '';
  
  // If it's the first prompt, make it default automatically (optional, but good UX)
  // But for now, we just render. User must save to persist.
  const selected = document.querySelector('input[name="default-prompt"]:checked');
  renderPrompts(selected ? selected.value : null);
}

function deletePrompt(id) {
  prompts = prompts.filter(p => p.id !== id);
  const selected = document.querySelector('input[name="default-prompt"]:checked');
  renderPrompts(selected ? selected.value : null);
}

function renderPrompts(defaultId) {
  const list = document.getElementById('prompts-list');
  list.innerHTML = '';
  
  prompts.forEach(p => {
    const div = document.createElement('div');
    div.className = 'prompt-item';
    
    const isChecked = p.id === defaultId ? 'checked' : '';
    
    div.innerHTML = `
      <div style="flex-grow: 1;">
        <div>
          <input type="radio" name="default-prompt" value="${p.id}" ${isChecked}>
          <strong>${escapeHtml(p.title)}</strong>
        </div>
        <div class="prompt-content" title="${escapeHtml(p.content)}">${escapeHtml(truncate(p.content, 100))}</div>
      </div>
      <button class="danger" data-id="${p.id}">Delete</button>
    `;
    
    div.querySelector('.danger').addEventListener('click', () => deletePrompt(p.id));
    list.appendChild(div);
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

function truncate(str, n) {
  return (str.length > n) ? str.slice(0, n-1) + '...' : str;
}
