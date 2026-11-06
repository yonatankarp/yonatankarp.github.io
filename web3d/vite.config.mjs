import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// `npm run build:building`: the pixel building as one ES module and one stylesheet in assets/building/, which the
// homepage template (layouts/index.html) fingerprints. The art itself is served from static/building/pixel/.
// `--mode library` builds the blog's Library (library.js, layouts/blog/list.html) the same way, apart, so neither page
// loads the other's code and no shared chunk needs a URL of its own.
export default defineConfig(({ mode }) => {
  const [entry, name] = mode === 'library' ? ['src/library.js', 'library'] : ['src/pixel.js', 'building'];
  return {
    root: here('.'),
    publicDir: false,
    build: {
      outDir: here('../assets/building'),
      emptyOutDir: false,   // overwrite the files in place: a running hugo server never sees the folder empty
      target: 'es2022',
      lib: { entry: here(entry), formats: ['es'], fileName: () => `${name}.js`, cssFileName: name },
      rolldownOptions: { output: { minify: true } },   // lib mode keeps an ES bundle's whitespace for other bundlers; this one goes straight to the browser
    },
  };
});
