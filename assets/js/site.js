document.addEventListener('DOMContentLoaded', () => {
  try {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');

    // The copy buttons' results, for screen readers (#183): a button's own label or class change is not announced.
    // In the page from the start, as a live region added at the moment it speaks may go unheard.
    let copyStatus = null, copyTimer = 0;
    if (document.querySelector('.article__content pre:not(.mermaid), .share-btn--copy')) {
      copyStatus = document.createElement('p');
      copyStatus.className = 'sr-only';
      copyStatus.setAttribute('role', 'status');
      document.body.append(copyStatus);
    }
    const announce = (said) => {
      if (!copyStatus) return;
      copyStatus.textContent = said;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { if (copyStatus.textContent === said) copyStatus.textContent = ''; }, 1600);   // so the next copy is announced again
    };

    // Copy-to-clipboard buttons on code blocks; Mermaid reads its <pre> as diagram source, so skip those. The button
    // goes in a frame around the pre, not in it, so it does not scroll away with the code (#251).
    document.querySelectorAll('.article__content pre:not(.mermaid)').forEach((pre) => {
      if (pre.parentElement.classList.contains('code-frame')) return;
      const frame = document.createElement('div');
      frame.className = 'code-frame';
      pre.before(frame);
      frame.append(pre);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code to clipboard');
      btn.addEventListener('click', async () => {
        const code = pre.querySelector('code') || pre;
        try {
          await navigator.clipboard.writeText(code.innerText.replace(/\n$/, ''));
          btn.textContent = 'Copied';
          announce('Code copied');
          setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
        } catch {
          btn.textContent = 'Error';
          announce('Could not copy the code');
        }
      });
      frame.append(btn);
    });

    // Copy-link button in the article share row
    document.querySelectorAll('.share-btn--copy').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const url = btn.getAttribute('data-share-url') || window.location.href;
        try {
          await navigator.clipboard.writeText(url);
          btn.classList.add('is-copied');
          announce('Link copied');
          setTimeout(() => btn.classList.remove('is-copied'), 1600);
        } catch {   // clipboard unavailable; the social links still work
          announce('Could not copy the link');
        }
      });
    });

    // Reading progress bar (article pages)
    const progress = document.getElementById('reading-progress');
    const articleBody = document.querySelector('.article__content');
    if (progress && articleBody && !media.matches) {
      const update = () => {
        const start = articleBody.offsetTop;
        const end = start + articleBody.offsetHeight - window.innerHeight;
        const pct = end > start ? ((window.scrollY - start) / (end - start)) * 100 : 0;
        progress.style.width = Math.min(100, Math.max(0, pct)) + '%';
      };
      update();
      window.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update, { passive: true });
    }

    const searchInput = document.getElementById('site-search');
    const searchResults = document.getElementById('search-results');
    const searchStatus = document.getElementById('search-status');
    if (searchInput && searchResults && searchStatus) {
      const hint = searchResults.cloneNode(true).childNodes;
      const initialQuery = new URLSearchParams(window.location.search).get('q');
      if (initialQuery) searchInput.value = initialQuery;
      searchInput.form?.addEventListener('submit', (event) => event.preventDefault());
      let pages = null, failed = false;

      // Matches from the start of a word or a camelCase hump: in full text, "ai" should not find "email", but
      // "coroutines" finds "useCoroutines". Case is folded by hand, as with the i flag \p{Lu} matches any letter.
      // $2 is the term itself.
      const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fold = (term) => [...term].map((char) => {
        const lower = char.toLowerCase();
        const upper = char.toUpperCase();
        return lower === upper ? escape(char) : `(?:${escape(lower)}|${escape(upper)})`;
      }).join('');
      const finder = (terms) => new RegExp(
        `(^|[^\\p{L}\\p{N}]|(?<=\\p{Ll})(?=\\p{Lu}))(${terms.map(fold).join('|')})`, 'gu');

      // The summary, unless a term is only in the body: then the words around that match.
      const excerpt = (item, finders) => {
        const hit = finders.find((find) => item.summary.search(find) < 0 && item.content.search(find) >= 0);
        if (!hit) return item.summary;
        const at = item.content.search(hit);
        const from = at > 70 ? item.content.indexOf(' ', at - 70) + 1 : 0;
        const cut = item.content.indexOf(' ', at + 130);
        const to = cut < 0 ? item.content.length : cut;
        return `${from ? '\u2026 ' : ''}${item.content.slice(from, to)}${to < item.content.length ? ' \u2026' : ''}`;
      };

      const score = (page, finders) => finders.reduce((sum, find) => sum
        + (page.title.search(find) >= 0 ? 100 : 0)
        + (page.summary.search(find) >= 0 ? 10 : 0)
        + (page.tags.search(find) >= 0 ? 10 : 0)
        + Math.min((page.content.match(find) || []).length, 9), 0);

      const render = (items, terms, finders) => {
        const any = finder(terms);
        searchResults.replaceChildren(...items.map((item) => {
          const article = document.createElement('article');
          article.className = 'search-result';

          const type = document.createElement('span');
          type.className = 'search-result__type';
          type.textContent = item.type;

          const link = document.createElement('a');
          link.href = item.permalink;
          link.textContent = item.title;

          const summary = document.createElement('p');
          const text = excerpt(item, finders);
          let last = 0;
          for (const match of text.matchAll(any)) {
            const at = match.index + match[1].length;
            const mark = document.createElement('mark');
            mark.textContent = match[2];
            summary.append(text.slice(last, at), mark);
            last = at + match[2].length;
          }
          summary.append(text.slice(last));

          article.append(type, link, summary);
          return article;
        }));
      };

      // Quotes are not part of a word: "spring boot" searches for spring and boot (#251). Double quotes go
      // anywhere, single ones only at a term's ends, so "don't" keeps its apostrophe.
      const termsOf = (query) => query.replace(/["\u201c\u201d\u201e\u00ab\u00bb]/g, ' ').split(/\s+/)
        .map((term) => term.replace(/^['\u2018\u2019]+|['\u2018\u2019]+$/g, '')).filter(Boolean);

      const runSearch = (query) => {
        const url = new URL(window.location.href);
        if (query.trim()) url.searchParams.set('q', query);
        else url.searchParams.delete('q');
        history.replaceState(null, '', url);

        if (failed) return;   // the message saying so stays
        const terms = termsOf(query);
        if (!terms.length) {
          searchResults.replaceChildren(...[...hint].map((node) => node.cloneNode(true)));
          searchStatus.textContent = '';
          return;
        }
        if (!pages) return;   // the index is on its way, and searches for what the box holds then
        const finders = terms.map((term) => finder([term]));
        const matches = pages.filter((page) => finders.every((find) => page.haystack.search(find) >= 0))
          .map((page) => [score(page, finders), page])
          .sort((a, b) => b[0] - a[0])
          .map(([, page]) => page);
        render(matches, terms, finders);
        const quoted = `\u201c${terms.join(' ')}\u201d`;
        const noun = matches.length === 1 ? 'result' : 'results';
        searchStatus.textContent = matches.length ? `${matches.length} ${noun} for ${quoted}.` : `No results for ${quoted}.`;
      };

      // The index is mostly full text (#251): fetched when the box is first used, not with every visit to the page.
      let loading = null;
      const loadIndex = () => {
        loading = loading || fetch('/index.json')
          .then((response) => {
            if (!response.ok) throw new Error(`index.json: HTTP ${response.status}`);
            return response.json();
          })
          .then((list) => {
            list.forEach((page) => {
              page.tags = (page.tags || []).join(' ');
              page.haystack = [page.title, page.type, page.summary, page.tags, page.content].join(' ');
            });
            pages = list;
            if (searchInput.value.trim()) runSearch(searchInput.value);
          })
          .catch(() => {
            failed = true;
            searchResults.replaceChildren();
            searchStatus.textContent = 'Search is unavailable right now. Browse the blog or the projects instead.';
          });
      };

      searchInput.addEventListener('focus', loadIndex);
      searchInput.addEventListener('input', () => {
        loadIndex();
        runSearch(searchInput.value);
      });
      if (searchInput.value.trim()) loadIndex();   // a ?q= link, or a query the browser kept on the way back
    }
  } catch {
    /* progressive enhancement only: the page works without it */
  }
});
