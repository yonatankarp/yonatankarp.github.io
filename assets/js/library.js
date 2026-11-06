// The blog's index (layouts/blog/list.html): the topic chips and the search box filter the list in place. Without this
// script the chips stay links to the tag pages and the search box a form to /search/.
const tools = document.querySelector('[data-library-tools]');
if (tools) {
  const input = tools.querySelector('input[name=q]'), count = document.querySelector('[data-library-count]');
  const rows = [...document.querySelector('[data-library-list]').children].map((li) => ({
    li, tags: li.dataset.tags.split(' '),
    text: `${li.querySelector('h2').textContent} ${li.querySelector('h2 + p').textContent}`.toLowerCase(),
  }));
  // The links become buttons that pick, as a link's Space and a button's pressed state differ.
  for (const a of tools.querySelectorAll('a[data-topic]')) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = a.className;
    Object.assign(b.dataset, a.dataset);
    b.setAttribute('aria-pressed', a.dataset.topic === '');
    b.append(...a.childNodes);
    a.replaceWith(b);
  }
  let topic = '', name = '';
  const show = () => {
    const q = input.value.trim(), lower = q.toLowerCase();
    let n = 0;
    for (const r of rows) n += !(r.li.hidden = (topic && !r.tags.includes(topic)) || !r.text.includes(lower));
    count.textContent = `${n} post${n === 1 ? '' : 's'}${topic ? ` on ${name}` : ''}${q ? ` matching “${q}”` : ''}, newest first`;
  };
  tools.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-topic]');
    if (!b) return;
    ({ topic, name } = b.dataset);
    for (const c of tools.querySelectorAll('button[data-topic]')) c.setAttribute('aria-pressed', c === b);
    // Counted here, as GoatCounter binds data-goatcounter-click when it loads, perhaps before these buttons exist.
    window.goatcounter?.count?.({ path: `topic-${topic || 'all'}`, title: name || 'All', event: true });
    show();
  });
  input.addEventListener('input', show);
  input.form.addEventListener('submit', (e) => e.preventDefault());   // the list already shows the matches
}
