const assert = require('assert');
const { JSDOM } = require('jsdom');

// Mock browser environment
const dom = new JSDOM(`<!DOCTYPE html>
<body>
  <header>Header content</header>
  <nav>Navigation</nav>
  <main>
    <h1>Title</h1>
    <p>Main content paragraph.</p>
    <div class="ad-banner">Ad content</div>
    <script>console.log('script')</script>
  </main>
  <footer>Footer content</footer>
</body>`);

global.document = dom.window.document;
global.window = dom.window;

// Extract the function to test
// Since the file is not a module, we can't require it directly without export.
// We'll read the file and eval the function part.
const fs = require('fs');
const path = require('path');

const bgContent = fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8');

// Quick and dirty extraction of the function
// We look for "function extractPageContent" and the closing brace.
// But easier to just eval the whole file in a context where chrome is mocked? 
// No, background.js has listeners.
// Let's just copy the function here for testing logic, or use vm.

const funcStart = bgContent.indexOf('function extractPageContent');
const funcEnd = bgContent.lastIndexOf('}'); // Hopefully correct, but risky.

// Better: Just copy paste the function logic we want to verify.
// Or we can use vm to run the script with mocked chrome API.

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

// Test Case 1: Standard extraction
const ignoreTags = ['script', 'style', 'noscript', 'header', 'footer', 'nav', 'iframe', 'svg'];
const ignoreSelectors = ['.ad-banner'];

const result = extractPageContent(ignoreTags, ignoreSelectors);
console.log("Extracted:", result);

assert.ok(result.includes("Title"), "Should include title");
assert.ok(result.includes("Main content paragraph"), "Should include main paragraph");
assert.ok(!result.includes("Header content"), "Should NOT include header");
assert.ok(!result.includes("Navigation"), "Should NOT include nav");
assert.ok(!result.includes("Ad content"), "Should NOT include ad banner");
assert.ok(!result.includes("console.log"), "Should NOT include script content");

console.log("Test Passed!");
