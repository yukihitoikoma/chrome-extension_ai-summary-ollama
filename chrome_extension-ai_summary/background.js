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

  // Helper to check if element should be ignored
  function shouldIgnore(element) {
    const tagName = element.tagName.toLowerCase();
    if (ignoreTags.includes(tagName)) return true;
    
    // Check selectors
    if (ignoreSelectors && ignoreSelectors.length > 0) {
      for (const selector of ignoreSelectors) {
        if (element.matches(selector)) return true;
      }
    }
    
    return false;
  }

  // Clone body to avoid modifying the actual page
  const clone = document.body.cloneNode(true);
  
  // Remove ignored elements
  // We need to traverse and remove.
  // A simple way is to use querySelectorAll for tags and selectors and remove them.
  
  // 1. Remove by Tag Name
  if (ignoreTags && ignoreTags.length > 0) {
    ignoreTags.forEach(tag => {
      const elements = clone.querySelectorAll(tag);
      elements.forEach(el => el.remove());
    });
  }

  // 2. Remove by Selectors
  if (ignoreSelectors && ignoreSelectors.length > 0) {
    ignoreSelectors.forEach(selector => {
      try {
        const elements = clone.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      } catch (e) {
        console.warn('Invalid selector:', selector);
      }
    });
  }
  
  // 3. Get text content
  // innerText is better than textContent because it respects CSS styling (hidden elements)
  // But innerText on a clone that isn't in the DOM might behave like textContent (no layout).
  // However, we want "readable" text.
  // textContent returns everything including hidden script contents if not removed.
  // We already removed script/style tags.
  
  // Let's try to get textContent and clean it up.
  let text = clone.innerText || clone.textContent || "";
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}
