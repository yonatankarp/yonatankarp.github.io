document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;

  try {
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.getElementById('primary-nav');
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (menuToggle && nav) {
      menuToggle.addEventListener('click', () => {
        const open = nav.classList.toggle('is-open');
        menuToggle.setAttribute('aria-expanded', String(open));
      });
    }

    const revealNodes = document.querySelectorAll('.reveal');
    if (revealNodes.length) {
      if (!media.matches && 'IntersectionObserver' in window) {
        root.classList.add('js-enabled');
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12 });

        revealNodes.forEach((el) => observer.observe(el));
      } else {
        revealNodes.forEach((el) => el.classList.add('is-visible'));
      }
    }

    const searchInput = document.getElementById('site-search');
    const searchResults = document.getElementById('search-results');
    if (searchInput && searchResults) {
      const indexPath = '/index.json';
      fetch(indexPath)
        .then((response) => response.json())
        .then((pages) => {
          const clearResults = () => {
            searchResults.replaceChildren();
          };

          const renderMessage = (message) => {
            clearResults();
            const node = document.createElement('p');
            node.textContent = message;
            searchResults.append(node);
          };

          const render = (items) => {
            if (!items.length) {
              renderMessage('No results found.');
              return;
            }
            clearResults();
            items.forEach((item) => {
              const article = document.createElement('article');
              article.className = 'search-result';

              const link = document.createElement('a');
              link.href = item.permalink;
              link.textContent = item.title;

              const summary = document.createElement('p');
              summary.textContent = item.summary || '';

              article.append(link, summary);
              searchResults.append(article);
            });
          };

          const runSearch = (pages, query) => {
            const q = query.trim().toLowerCase();
            if (!q) {
              clearResults();
              return;
            }
            const filtered = pages.filter((page) => {
              return [page.title, page.summary, page.content].join(' ').toLowerCase().includes(q);
            }).slice(0, 10);
            render(filtered);
          };

          searchInput.addEventListener('input', () => {
            runSearch(pages, searchInput.value);
          });

          const initialQuery = new URLSearchParams(window.location.search).get('q') || '';
          if (initialQuery) {
            searchInput.value = initialQuery;
            runSearch(pages, initialQuery);
          }
        })
        .catch(() => {
          const node = document.createElement('p');
          node.textContent = 'Search is unavailable right now.';
          searchResults.replaceChildren(node);
        });
    }
  } catch {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
    root.classList.remove('js-enabled');
  }
});
