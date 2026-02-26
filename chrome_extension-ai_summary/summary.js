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
  document.getElementById('download-content-btn').addEventListener('click', () => downloadContent('extracted-content'));
  
  document.getElementById('copy-response-btn').addEventListener('click', () => copyToClipboard('ai-response'));
  document.getElementById('download-response-btn').addEventListener('click', () => downloadContent('ai-response'));

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
  
  // Add "No Selection" option
  const noSelOpt = document.createElement('option');
  noSelOpt.value = "custom";
  noSelOpt.text = "No Selection (Custom Prompt)";
  select.add(noSelOpt);

  if (!prompts || prompts.length === 0) {
    // If no configured prompts, custom is default
    select.value = "custom";
    document.getElementById('custom-prompt-container').style.display = 'block';
    
    // Add link to settings in status if no prompts exist at all
    const status = document.getElementById('status');
    status.innerHTML = 'No system prompts found. <a href="#" id="link-settings">Configure in Settings</a>';
    document.getElementById('link-settings').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });
  } else {
    // Add configured prompts
    prompts.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.text = p.title;
      select.add(opt);
    });
    
    // Set default
    if (data.defaultPromptId && prompts.find(p => p.id === data.defaultPromptId)) {
        select.value = data.defaultPromptId;
    } else {
        // Default to first real prompt if available, or custom
        if (prompts.length > 0) {
            select.selectedIndex = 1; // 0 is "No Selection"
        } else {
            select.value = "custom";
        }
    }
  }

  // Show/Hide custom prompt area based on initial selection
  toggleCustomPrompt(select.value);

  // Add change listener
  select.addEventListener('change', (e) => {
    toggleCustomPrompt(e.target.value);
  });

  // Auto-run? Only if a valid system prompt is selected as default.
  // If custom is default (which shouldn't happen by id check above unless id matches "custom"?), don't auto-run.
  if (data.defaultPromptId && select.value === data.defaultPromptId) {
      setTimeout(() => runAI(data.defaultPromptId), 500);
  }
});

function toggleCustomPrompt(value) {
    const container = document.getElementById('custom-prompt-container');
    if (value === 'custom') {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

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
    
    // Allow if promptId is "custom" OR valid ID
    if (!promptId) {
       // Should not happen with current logic but just in case
       document.getElementById('status').innerText = "Error: Please select a prompt mode.";
       return;
    }
    
    runAI(promptId);
  }
}

async function runAI(promptId) {
  let systemContent = "";
  let userContent = currentExtractedText;

  if (promptId === 'custom') {
    // Custom Prompt Mode
    const userPrompt = document.getElementById('user-prompt').value.trim();
    if (userPrompt) {
        userContent = `${userPrompt}\n\n■対象テキスト\n${currentExtractedText}`;
    }
    // systemContent remains empty
  } else {
    // System Prompt Mode
    const promptObj = prompts.find(p => p.id === promptId);
    if (!promptObj) {
        document.getElementById('status').innerText = "Error: Selected prompt not found.";
        return;
    }
    systemContent = promptObj.content;
  }

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
    // ユーザーが入力したホストURLから末尾のスラッシュを削除
    const hostUrl = ollamaSettings.host.replace(/\/+$/, '');

    const response = await fetch(`${hostUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: ollamaSettings.model,
        prompt: userContent,
        system: systemContent,
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

function downloadContent(elementId) {
  let text = "";
  let filename = "download.txt";
  
  if (elementId === 'ai-response') {
    text = currentMarkdownResponse || ""; 
    filename = "ai-summary.md";
  } else {
    const el = document.getElementById(elementId);
    if (el) {
        text = el.innerText || "";
    }
    filename = "extracted-content.txt";
  }

  if (!text) {
    alert("No content to download.");
    return;
  }

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
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
