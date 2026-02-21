let abortController = null;
let currentExtractedText = "";
let currentMarkdownResponse = ""; // Store raw markdown
let ollamaSettings = {};
let prompts = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Event Listeners
  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  document.getElementById('ai-btn').addEventListener('click', handleAIButtonClick);
  
  document.getElementById('copy-content-btn').addEventListener('click', () => copyToClipboard('extracted-content'));
  document.getElementById('copy-response-btn').addEventListener('click', () => copyToClipboard('ai-response'));

  // Load Data
  let data = {};
  try {
    data = await chrome.storage.local.get([
      'currentExtractedText', 
      'prompts', 
      'defaultPromptId', 
      'ollamaHost', 
      'ollamaModel'
    ]);
  } catch (e) {
    console.error("Failed to load settings:", e);
    document.getElementById('status').innerText = "Error loading settings.";
  }

  console.log("Loaded data:", data);

  currentExtractedText = data.currentExtractedText || "No content extracted. Please try selecting text or reloading the page.";
  prompts = data.prompts || [];
  ollamaSettings = {
    host: data.ollamaHost || 'http://localhost:11434',
    model: data.ollamaModel || 'llama3'
  };

  // Render Content
  document.getElementById('extracted-content').innerText = currentExtractedText;

  // Render Dropdown
  const select = document.getElementById('prompt-select');
  select.innerHTML = ''; // Clear existing
  
  if (!prompts || prompts.length === 0) {
    const opt = document.createElement('option');
    opt.text = "No prompts configured (Go to Settings)";
    select.add(opt);
    select.disabled = true;
    // Add link to settings in status
    const status = document.getElementById('status');
    status.innerHTML = 'No system prompts found. <a href="#" id="link-settings">Configure in Settings</a>';
    document.getElementById('link-settings').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });
  } else {
    select.disabled = false;
    // Add default empty option if no default is set? No, let's just select the default or the first one.
    prompts.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.text = p.title;
      if (p.id === data.defaultPromptId) {
        opt.selected = true;
      }
      select.add(opt);
    });
    
    // If no default was selected, select the first one
    if (!select.value && prompts.length > 0) {
        select.selectedIndex = 0;
    }
  }

  // Auto-run?
  if (data.defaultPromptId && prompts.find(p => p.id === data.defaultPromptId)) {
    // Small delay to ensure UI is ready
    setTimeout(() => runAI(data.defaultPromptId), 100);
  }
});

function handleAIButtonClick() {
  if (abortController) {
    // It's a Stop button
    abortController.abort();
    abortController = null;
    updateButtonState(false);
    document.getElementById('status').innerText = "Stopped.";
  } else {
    // It's a Run button
    const select = document.getElementById('prompt-select');
    const promptId = select.value;
    
    if (!promptId || prompts.length === 0) {
      document.getElementById('status').innerText = "Error: No system prompt selected.";
      return;
    }
    
    runAI(promptId);
  }
}

async function runAI(promptId) {
  const promptObj = prompts.find(p => p.id === promptId);
  if (!promptObj) return;

  const btn = document.getElementById('ai-btn');
  const status = document.getElementById('status');
  const responseDiv = document.getElementById('ai-response');

  // Reset
  responseDiv.innerHTML = '<div class="spinner"></div> Processing...';
  status.innerText = "Requesting AI...";
  currentMarkdownResponse = ""; // Reset markdown storage
  
  abortController = new AbortController();
  updateButtonState(true);

  try {
    const response = await fetch(`${ollamaSettings.host}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: ollamaSettings.model,
        prompt: currentExtractedText,
        system: promptObj.content,
        stream: false
      }),
      signal: abortController.signal
    });

    if (!response.ok) {
      throw new Error(`Ollama API Error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    
    if (json.error) {
      throw new Error(json.error);
    }

    currentMarkdownResponse = json.response; // Store raw markdown
    renderMarkdown(json.response);
    status.innerText = "Done.";

  } catch (err) {
    if (err.name === 'AbortError') {
      status.innerText = "Stopped.";
      responseDiv.innerHTML += " [Aborted]";
    } else {
      status.innerText = "Error.";
      responseDiv.innerHTML = `<span style="color:red">Error: ${err.message}</span>`;
      console.error(err);
    }
  } finally {
    abortController = null;
    updateButtonState(false);
  }
}

function updateButtonState(isRunning) {
  const btn = document.getElementById('ai-btn');
  if (isRunning) {
    btn.innerText = "Stop";
    btn.classList.add('danger');
  } else {
    btn.innerText = "Run AI Analysis";
    btn.classList.remove('danger');
  }
}

function copyToClipboard(elementId) {
  let text = "";
  
  if (elementId === 'ai-response') {
    text = currentMarkdownResponse; // Copy raw markdown
  } else {
    const el = document.getElementById(elementId);
    text = el.innerText;
  }

  if (!text) {
    // Nothing to copy
    return;
  }

  // Let's use navigator.clipboard
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector(`button[id="copy-${elementId === 'extracted-content' ? 'content' : 'response'}-btn"]`);
    const originalText = btn.innerText;
    btn.innerText = "Copied!";
    setTimeout(() => btn.innerText = originalText, 1500);
  });
}

// Simple Markdown Parser
function renderMarkdown(text) {
  const container = document.getElementById('ai-response');
  if (!text) {
    container.innerHTML = '';
    return;
  }

  // Escape HTML first to prevent XSS (though we trust Ollama usually, better safe)
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*)\*\*/gim, '<b>$1</b>');
  html = html.replace(/__(.*)__/gim, '<b>$1</b>');

  // Italic
  html = html.replace(/\*(.*)\*/gim, '<i>$1</i>');
  html = html.replace(/_(.*)_/gim, '<i>$1</i>');

  // Code Blocks (fenced)
  html = html.replace(/```([^`]+)```/gs, '<pre><code>$1</code></pre>');

  // Inline Code
  html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

  // Lists (Unordered) - Simple logic
  // Replace * or - at start of line with <li>
  // Wrap sequential <li> in <ul> is hard with regex alone.
  // We'll just turn lines starting with - into <li> and wrap everything in a div, or let CSS handle it.
  // Better: replace - (.*) with <li>$1</li>
  html = html.replace(/^\s*[\-\*] (.*$)/gim, '<li>$1</li>');
  
  // Wrap <li>s in <ul>? 
  // A simple hack: just wrap the whole thing or leave as is. 
  // Without <ul>, <li> might not render bullets correctly depending on browser, but typically needs a list parent.
  // Let's try to wrap sequential <li>s.
  // This is hard with regex. 
  // Alternative: convert newlines to <br> for non-list items.
  
  html = html.replace(/\n/g, '<br>');
  
  // Fix the <li><br> issue
  html = html.replace(/<\/li><br>/g, '</li>');
  
  container.innerHTML = html;
}
