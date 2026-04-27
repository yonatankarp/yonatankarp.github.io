document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('primary-nav');
  const themeToggle = document.querySelector('.theme-toggle');
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      localStorage.setItem('theme', next);
    });
  }

  if (!media.matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
  }

  const searchInput = document.getElementById('site-search');
  const searchResults = document.getElementById('search-results');
  if (searchInput && searchResults) {
    const indexPath = '/index.json';
    fetch(indexPath)
      .then((response) => response.json())
      .then((pages) => {
        const render = (items) => {
          if (!items.length) {
            searchResults.innerHTML = '<p>No results found.</p>';
            return;
          }
          searchResults.innerHTML = items.map((item) => `\n            <article class="search-result">\n              <a href="${item.permalink}">${item.title}</a>\n              <p>${item.summary || ''}</p>\n            </article>\n          `).join('');
        };

        searchInput.addEventListener('input', () => {
          const q = searchInput.value.trim().toLowerCase();
          if (!q) {
            searchResults.innerHTML = '';
            return;
          }
          const filtered = pages.filter((page) => {
            return [page.title, page.summary, page.content].join(' ').toLowerCase().includes(q);
          }).slice(0, 10);
          render(filtered);
        });
      })
      .catch(() => {
        searchResults.innerHTML = '<p>Search is unavailable right now.</p>';
      });
  }
});
