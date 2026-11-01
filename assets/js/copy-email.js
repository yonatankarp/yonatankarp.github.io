// Copy chips beside the email address, for readers whose mailto opens nothing (#153). One file for two pages: the
// homepage bundle imports it (web3d/src/pixel.js), the CV loads it through Hugo pipes (layouts/_default/cv.html).
// The chips render hidden and show only where the clipboard API exists; [data-copy-status] announces the copy.
if (navigator.clipboard?.writeText) {
  document.querySelectorAll('[data-copy-email]').forEach((button) => {
    // An open floor panel is a modal dialog: a live region outside it may go unheard, so it has its own.
    const status = button.closest('.floor-panel')?.querySelector('[data-copy-status]') ?? document.querySelector('[data-copy-status]');
    let timer = 0;
    button.hidden = false;
    button.addEventListener('click', async () => {
      let said;
      try {
        await navigator.clipboard.writeText(button.dataset.copyEmail);
        [button.textContent, said] = ['Copied', 'Email address copied'];
      } catch {   // refused: the mailto link beside it still works
        [button.textContent, said] = ['Failed', 'Could not copy the email address'];
      }
      if (status) status.textContent = said;
      clearTimeout(timer);
      timer = setTimeout(() => {
        button.textContent = 'Copy';
        if (status?.textContent === said) status.textContent = '';   // so the next copy is announced again
      }, 1500);
    });
  });
}
