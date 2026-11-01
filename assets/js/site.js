document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;

  try {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');

    const revealNodes = document.querySelectorAll('.reveal');
    if (revealNodes.length) {
      const revealAll = () => {
        revealNodes.forEach((el) => el.classList.add('is-visible'));
        root.classList.remove('js-enabled');
      };

      if (!media.matches && 'IntersectionObserver' in window) {
        root.classList.add('js-enabled');
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0, rootMargin: '0px 0px 10% 0px' });

        revealNodes.forEach((el) => observer.observe(el));
        window.addEventListener('beforeprint', revealAll, { once: true });
      } else {
        revealAll();
      }
    }

    // Copy-to-clipboard buttons on code blocks; Mermaid reads its <pre> as diagram source, so skip those
    document.querySelectorAll('.article__content pre:not(.mermaid)').forEach((pre) => {
      if (pre.querySelector('.code-copy')) return;
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
          setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
        } catch {
          btn.textContent = 'Error';
        }
      });
      pre.appendChild(btn);
    });

    // Copy-link button in the article share row
    document.querySelectorAll('.share-btn--copy').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const url = btn.getAttribute('data-share-url') || window.location.href;
        try {
          await navigator.clipboard.writeText(url);
          btn.classList.add('is-copied');
          setTimeout(() => btn.classList.remove('is-copied'), 1600);
        } catch {
          /* clipboard unavailable; the social links still work */
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
      fetch('/index.json')
        .then((response) => {
          if (!response.ok) throw new Error(`index.json: HTTP ${response.status}`);
          return response.json();
        })
        .then((pages) => {
          pages.forEach((page) => {
            page.haystack = [page.title, page.type, page.summary, page.content].join(' ').toLowerCase();
          });

          const render = (items) => {
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
              summary.textContent = item.summary || '';

              article.append(type, link, summary);
              return article;
            }));
          };

          const runSearch = (query) => {
            const url = new URL(window.location.href);
            if (query.trim()) url.searchParams.set('q', query);
            else url.searchParams.delete('q');
            history.replaceState(null, '', url);

            const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
            if (!terms.length) {
              searchResults.replaceChildren(...[...hint].map((node) => node.cloneNode(true)));
              searchStatus.textContent = '';
              return;
            }
            const matches = pages.filter((page) => terms.every((term) => page.haystack.includes(term)));
            const shown = matches.slice(0, 10);
            render(shown);
            const quoted = `\u201c${query.trim()}\u201d`;
            const noun = matches.length === 1 ? 'result' : 'results';
            searchStatus.textContent = !matches.length ? `No results for ${quoted}.`
              : shown.length < matches.length ? `Showing ${shown.length} of ${matches.length} results for ${quoted}.`
              : `${matches.length} ${noun} for ${quoted}.`;
          };

          searchInput.addEventListener('input', () => runSearch(searchInput.value));
          if (searchInput.value.trim()) runSearch(searchInput.value);
        })
        .catch(() => {
          searchResults.replaceChildren();
          searchStatus.textContent = 'Search is unavailable right now. Browse the blog or the projects instead.';
        });
    }
  } catch {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
    root.classList.remove('js-enabled');
  }
});
