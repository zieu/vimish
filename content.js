(() => {
  if (window.__vimish) return;
  window.__vimish = true;

  const SCROLL_STEP = 60;
  const SCROLL_SPEED = 0.9; // px per ms
  const HINT_CHARS = 'sadfjklewcmpgh';
  const CLICKABLE = [
    'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea', 'summary', 'label',
    '[role=button]', '[role=link]', '[role=tab]', '[role=menuitem]', '[role=checkbox]', '[role=option]',
    '[onclick]', '[contenteditable=""]', '[contenteditable=true]', '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  const isEditable = (el) =>
    !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

  function makeShadowHost(css) {
    const host = document.createElement('div');
    host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;';
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = css;
    root.append(style);
    document.documentElement.append(host);
    return { host, root };
  }

  // ---------- scrolling ----------

  function scrollTarget() {
    const doc = document.scrollingElement || document.documentElement;
    const hidden = (el) => el && getComputedStyle(el).overflowY === 'hidden';
    if (doc.scrollHeight > doc.clientHeight && !hidden(document.documentElement) && !hidden(document.body)) {
      return doc;
    }
    // App-style pages (body locked, inner pane scrolls): find the scrollable ancestor of the center element.
    let el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    while (el && el !== document.documentElement) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return doc;
  }

  let scroller = null; // { key, dir, el, start, from, held }

  // Scrolls at a constant speed for as long as the key is held, ignoring OS key repeat.
  // A tap still travels at least SCROLL_STEP.
  function startScroll(key, dir) {
    if (scroller?.key === key && scroller.held) return;
    const el = scrollTarget();
    scroller = { key, dir, el, start: performance.now(), from: el.scrollTop, held: true };
    const s = scroller;
    const frame = (now) => {
      if (scroller !== s) return;
      const moved = (now - s.start) * SCROLL_SPEED;
      // 'instant' overrides any `scroll-behavior: smooth` the page sets, which would fight per-frame updates.
      s.el.scrollTo({ top: s.from + s.dir * moved, behavior: 'instant' });
      if (s.held || moved < SCROLL_STEP) requestAnimationFrame(frame);
      else scroller = null;
    };
    requestAnimationFrame(frame);
  }

  function stopScroll(key) {
    if (!scroller || (key && scroller.key !== key)) return;
    scroller.held = false;
  }

  window.addEventListener('keyup', (e) => stopScroll(e.key.toLowerCase()), true);
  window.addEventListener('blur', () => stopScroll());

  function scrollToEdge(bottom) {
    const t = scrollTarget();
    t.scrollTo({ top: bottom ? t.scrollHeight : 0, behavior: 'smooth' });
  }

  // ---------- link hints ----------

  let hints = null; // { host, items: [{ el, label, node }], typed }

  function hitPoint(el) {
    for (const r of el.getClientRects()) {
      if (r.width < 2 || r.height < 2) continue;
      if (r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) continue;
      const points = [
        [r.left + r.width / 2, r.top + r.height / 2],
        [r.left + 2, r.top + 2],
      ];
      for (const [x, y] of points) {
        const cx = Math.min(Math.max(x, 0), innerWidth - 1);
        const cy = Math.min(Math.max(y, 0), innerHeight - 1);
        const hit = document.elementFromPoint(cx, cy);
        if (hit && (hit === el || el.contains(hit))) return r;
      }
    }
    return null;
  }

  function makeLabels(n) {
    const L = HINT_CHARS.length;
    const len = Math.max(1, Math.ceil(Math.log(n) / Math.log(L)));
    return Array.from({ length: n }, (_, i) => {
      let s = '';
      for (let k = 0; k < len; k++) {
        s = HINT_CHARS[i % L] + s;
        i = Math.floor(i / L);
      }
      return s;
    });
  }

  function showHints() {
    const targets = [];
    for (const el of document.querySelectorAll(CLICKABLE)) {
      if (el.disabled) continue;
      const rect = hitPoint(el);
      if (rect) targets.push({ el, rect });
    }
    if (!targets.length) return;

    const { host, root } = makeShadowHost(`
      .hint {
        position: fixed;
        font: bold 11px/1 ui-monospace, Menlo, monospace;
        text-transform: uppercase;
        padding: 2px 3px;
        color: #302505;
        background: linear-gradient(#fff785, #ffc542);
        border: 1px solid #c38a22;
        border-radius: 3px;
        box-shadow: 0 2px 4px rgba(0,0,0,.3);
      }
      .typed { opacity: .4; }
    `);
    const labels = makeLabels(targets.length);
    const items = targets.map(({ el, rect }, i) => {
      const node = document.createElement('span');
      node.className = 'hint';
      node.style.left = `${Math.max(0, rect.left)}px`;
      node.style.top = `${Math.max(0, rect.top)}px`;
      node.textContent = labels[i];
      root.append(node);
      return { el, label: labels[i], node };
    });
    hints = { host, items, typed: '' };
  }

  function hideHints() {
    hints?.host.remove();
    hints = null;
  }

  function updateHints() {
    const { items, typed } = hints;
    const matching = items.filter((h) => h.label.startsWith(typed));
    if (matching.length === 1 && matching[0].label === typed) {
      const { el } = matching[0];
      hideHints();
      activate(el);
      return;
    }
    if (!matching.length) {
      hideHints();
      return;
    }
    for (const h of items) {
      const on = h.label.startsWith(typed);
      h.node.style.display = on ? '' : 'none';
      if (on) {
        h.node.innerHTML = '';
        const done = document.createElement('span');
        done.className = 'typed';
        done.textContent = typed;
        h.node.append(done, h.label.slice(typed.length));
      }
    }
  }

  function activate(el) {
    const textInput = isEditable(el) && !(el.tagName === 'INPUT' && /^(checkbox|radio|button|submit|reset|file|image|color|range)$/.test(el.type));
    if (textInput) {
      el.focus();
    } else {
      el.focus({ preventScroll: true });
      el.click();
    }
  }

  function onHintKey(e) {
    if (e.key === 'Escape') hideHints();
    else if (e.key === 'Backspace') {
      hints.typed = hints.typed.slice(0, -1);
      updateHints();
    } else if (e.key.length === 1 && HINT_CHARS.includes(e.key.toLowerCase())) {
      hints.typed += e.key.toLowerCase();
      updateHints();
    }
  }

  // ---------- find ----------

  let matches = [];
  let current = -1;
  let bar = null; // { host, input, count }

  function search(query) {
    matches = [];
    current = -1;
    if (query && document.body) {
      const smartCase = query !== query.toLowerCase();
      const needle = smartCase ? query : query.toLowerCase();
      const visible = new Map();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (!visible.has(p)) {
            visible.set(p, !p.closest('script,style,noscript,template') && p.checkVisibility());
          }
          return visible.get(p) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
      for (let node; (node = walker.nextNode()) && matches.length < 5000; ) {
        const text = smartCase ? node.data : node.data.toLowerCase();
        for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + needle.length)) {
          const r = new Range();
          r.setStart(node, i);
          r.setEnd(node, i + needle.length);
          matches.push(r);
        }
      }
    }
    paint();
  }

  function paint() {
    if (!window.CSS?.highlights) return;
    CSS.highlights.delete('vimish-match');
    CSS.highlights.delete('vimish-current');
    if (matches.length) CSS.highlights.set('vimish-match', new Highlight(...matches));
    if (matches[current]) {
      const cur = new Highlight(matches[current]);
      cur.priority = 1;
      CSS.highlights.set('vimish-current', cur);
    }
    if (bar) bar.count.textContent = matches.length ? `${current + 1}/${matches.length}` : bar.input.value ? '0/0' : '';
  }

  function jump(i) {
    if (!matches.length) return;
    current = (i + matches.length) % matches.length;
    paint();
    const range = matches[current];
    const r = range.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) {
      range.startContainer.parentElement?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  }

  function firstInView() {
    const i = matches.findIndex((r) => r.getBoundingClientRect().top >= 0);
    return i === -1 ? 0 : i;
  }

  function clearSearch() {
    matches = [];
    current = -1;
    paint();
  }

  function openBar() {
    if (bar) {
      bar.input.focus();
      bar.input.select();
      return;
    }
    const prevFocus = document.activeElement;
    const { host, root } = makeShadowHost(`
      .bar {
        position: fixed;
        left: 0; right: 0; bottom: 0;
        display: flex; align-items: center; gap: 8px;
        padding: 6px 10px;
        background: #1e1e1e; color: #ddd;
        font: 14px/1.4 ui-monospace, Menlo, monospace;
        border-top: 1px solid #444;
        pointer-events: auto;
      }
      input {
        flex: 1;
        background: transparent; color: inherit; font: inherit;
        border: 0; outline: 0; padding: 0;
      }
      .count { color: #999; }
    `);
    const wrap = document.createElement('div');
    wrap.className = 'bar';
    const input = document.createElement('input');
    input.spellcheck = false;
    const count = document.createElement('span');
    count.className = 'count';
    wrap.append('/', input, count);
    root.append(wrap);
    input.addEventListener('input', () => {
      search(input.value);
      jump(firstInView());
    });
    bar = { host, input, count, prevFocus };
    input.focus();
  }

  function closeBar(keep) {
    if (!bar) return;
    const { host, prevFocus } = bar;
    bar = null;
    host.remove();
    if (!keep) clearSearch();
    if (prevFocus && prevFocus !== document.body) prevFocus.focus?.({ preventScroll: true });
  }

  function onBarKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeBar(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      closeBar(true);
    }
  }

  // ---------- dispatch ----------

  window.addEventListener(
    'keydown',
    (e) => {
      if (hints) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onHintKey(e);
        return;
      }

      const target = e.composedPath()[0];
      if (bar && target === bar.input) {
        // Keep page shortcuts from seeing keys typed into the find bar; typing still works.
        e.stopImmediatePropagation();
        onBarKey(e);
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (isEditable(target)) return;

      const actions = {
        j: () => startScroll('j', 1),
        k: () => startScroll('k', -1),
        g: () => scrollToEdge(false),
        G: () => scrollToEdge(true),
        H: () => history.back(),
        L: () => history.forward(),
        f: showHints,
        '/': openBar,
        n: () => jump(current + 1),
        N: () => jump(current - 1),
      };

      if (e.key === 'Escape') {
        clearSearch();
        return;
      }
      const action = actions[e.key];
      if (!action) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      action();
    },
    true,
  );
})();
