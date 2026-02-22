chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "summarize-page",
    title: "Summarize with AI",
    contexts: ["page", "selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "summarize-page") {
    handleSummarize(info, tab);
  }
});

async function handleSummarize(info, tab) {
  try {
    // 1. Get Settings
    const settings = await chrome.storage.local.get({
      ignoreTags: ['script', 'style', 'noscript', 'header', 'footer', 'nav', 'iframe', 'svg'],
      ignoreSelectors: []
    });

    let extractedText = "";

    // 2. Check for Selection Text first
    if (info.selectionText) {
      extractedText = info.selectionText;
    } else {
      // 3. Execute Script to Extract Text from Page
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageContent,
        args: [settings.ignoreTags, settings.ignoreSelectors]
      });

      if (injectionResults && injectionResults[0] && injectionResults[0].result) {
        extractedText = injectionResults[0].result;
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      // Fallback or Error
      console.warn("No text extracted.");
      extractedText = "Could not extract any text from this page. It might be protected, empty, or an unsupported format.";
    }

    // 4. Save to Storage
    await chrome.storage.local.set({
      currentExtractedText: extractedText,
      sourceUrl: tab.url,
      sourceTitle: tab.title
    });

    // 5. Open Summary Tab
    chrome.tabs.create({
      url: 'summary.html'
    });

  } catch (err) {
    console.error('Error during summarization:', err);
    // Try to alert the user in the active tab
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (msg) => { alert("AI Summarizer Error: " + msg); },
      args: [err.message]
    }).catch(() => {}); // Ignore if alert fails
  }
}

// content script function (runs in the context of the page)
function extractPageContent(ignoreTags, ignoreSelectors) {
  if (!document || !document.body) return "";

  function isVisible(el) {
    if (el.nodeType !== Node.ELEMENT_NODE) return true; 
    
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function shouldIgnore(el) {
    if (el.nodeType !== Node.ELEMENT_NODE) return false;
    
    const tagName = el.tagName.toLowerCase();
    if (ignoreTags && ignoreTags.includes(tagName)) return true;
    
    if (ignoreSelectors && ignoreSelectors.length > 0) {
      for (const selector of ignoreSelectors) {
        if (el.matches(selector)) return true;
      }
    }
    return false;
  }

  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (shouldIgnore(node)) return "";
      if (!isVisible(node)) return "";
      
      let text = "";
      for (const child of node.childNodes) {
        text += traverse(child);
      }
      
      // Add a space for block elements to prevent words merging
      const tagName = node.tagName.toLowerCase();
      const blockTags = [
        'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br', 'article', 'section', 
        'header', 'footer', 'nav', 'aside', 'tr', 'ul', 'ol', 'blockquote', 'main', 
        'pre', 'form', 'figure', 'figcaption', 'dl', 'dt', 'dd', 'table', 'tbody', 'thead', 'tfoot', 'td', 'th', 'caption'
      ];
      
      if (blockTags.includes(tagName)) {
        return " " + text + " ";
      }
      return text;
    }
    return "";
  }
  
  let text = traverse(document.body);
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}
