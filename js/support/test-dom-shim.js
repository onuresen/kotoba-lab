// test-dom-shim.js — NOT a test file (doesn't match js/*.test.js, so `npm
// test` never runs it on its own) and NOT shipped with the app. It exists so
// read.js's rendering and click routing can be tested under plain Node,
// which has no DOM, without adding a real DOM library — this project is
// zero-dependency by design (see package.json's description and CLAUDE.md's
// code preferences).
//
// It implements exactly the DOM surface read.js touches: innerHTML (write
// parses read.js's own generated markup into a tree; there is no reader
// needed since tests only read the tree via querySelectorAll/closest),
// querySelectorAll/closest for the selector shapes read.js actually uses
// (".a.b" compound class selectors, "[data-x]" attribute presence),
// classList, and dataset. It is deliberately not a general HTML/CSS engine —
// if a future test needs a selector or tag shape this doesn't cover, extend
// it narrowly for that shape rather than growing this into jsdom.

function decodeEntities(s) {
  return s.replace(/&amp;|&lt;|&gt;|&quot;/g, (m) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' }[m]));
}

class TextNode {
  constructor(text) { this.text = text; this.parent = null; }
}

class Element {
  constructor(tagName, attrs) {
    this.tagName = tagName.toUpperCase();
    this.attrs = attrs; // Map<string, string>
    this.children = [];
    this.parent = null;
  }

  get dataset() {
    const ds = {};
    for (const [key, value] of this.attrs) {
      if (key.startsWith('data-')) {
        const camel = key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        ds[camel] = value;
      }
    }
    return ds;
  }

  get classList() {
    const classes = new Set(String(this.attrs.get('class') || '').split(/\s+/).filter(Boolean));
    const sync = () => this.attrs.set('class', [...classes].join(' '));
    return {
      add: (c) => { classes.add(c); sync(); },
      remove: (c) => { classes.delete(c); sync(); },
      toggle: (c, force) => {
        const want = force === undefined ? !classes.has(c) : force;
        if (want) classes.add(c); else classes.delete(c);
        sync();
        return want;
      },
      contains: (c) => classes.has(c),
    };
  }

  // Only the selector shapes read.js's own code uses: a run of one or more
  // ".class" pieces (all must match), or a single "[data-attr]" presence
  // check. Anything else throws rather than silently matching nothing.
  matches(selector) {
    if (selector.startsWith('.')) {
      return selector.slice(1).split('.').every((c) => this.classList.contains(c));
    }
    if (selector.startsWith('[') && selector.endsWith(']')) {
      return this.attrs.has(selector.slice(1, -1));
    }
    throw new Error(`test-dom-shim: unsupported selector "${selector}"`);
  }

  closest(selector) {
    for (let node = this; node instanceof Element; node = node.parent) {
      if (node.matches(selector)) return node;
    }
    return null;
  }

  querySelectorAll(selector) {
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (child instanceof Element) {
          if (child.matches(selector)) out.push(child);
          walk(child);
        }
      }
    };
    walk(this);
    return out;
  }

  get textContent() {
    let out = '';
    const walk = (node) => {
      for (const child of node.children) {
        if (child instanceof TextNode) out += child.text;
        else walk(child);
      }
    };
    walk(this);
    return out;
  }
}

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g;

// Parses the small, well-formed subset of HTML read.js itself generates:
// <span>/<ruby>/<rt> tags, double-quoted attributes, no self-closing tags,
// no comments. Not a general parser — read.js's output is the only input.
function parseFragment(html) {
  const root = new Element('#fragment', new Map());
  const stack = [root];
  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      const close = html.indexOf('>', i);
      if (close === -1) break;
      const raw = html.slice(i + 1, close);
      if (raw.startsWith('/')) {
        stack.pop();
      } else {
        const spaceIdx = raw.search(/\s/);
        const tagName = (spaceIdx === -1 ? raw : raw.slice(0, spaceIdx)).trim();
        const attrs = new Map();
        ATTR_RE.lastIndex = 0;
        let m;
        while ((m = ATTR_RE.exec(spaceIdx === -1 ? '' : raw.slice(spaceIdx)))) {
          attrs.set(m[1], decodeEntities(m[2]));
        }
        const el = new Element(tagName, attrs);
        el.parent = stack.at(-1);
        stack.at(-1).children.push(el);
        stack.push(el);
      }
      i = close + 1;
    } else {
      const next = html.indexOf('<', i);
      const end = next === -1 ? html.length : next;
      const text = html.slice(i, end);
      if (text) {
        const node = new TextNode(decodeEntities(text));
        node.parent = stack.at(-1);
        stack.at(-1).children.push(node);
      }
      i = end;
    }
  }
  return root;
}

// A container standing in for the real element read.js is handed: an
// innerHTML setter that parses read.js's markup into the tree above, plus
// querySelectorAll/onclick, exactly what applyKnownClasses/renderReading use.
export function createContainer() {
  let root = new Element('#container', new Map());
  return {
    set innerHTML(html) { root = parseFragment(html); },
    querySelectorAll(selector) { return root.querySelectorAll(selector); },
    onclick: null,
    // Test helper: run the handler renderReading installed as if `target`
    // (an Element from a prior querySelectorAll/closest call) was clicked.
    click(target) { this.onclick?.({ target }); },
  };
}
