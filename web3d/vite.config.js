import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// `npm run build:building`: the pixel building as one ES module and one stylesheet in assets/building/, which the
// homepage template (layouts/index.html) fingerprints. The art itself is served from static/building/pixel/.
export default defineConfig({
  root: here('.'),
  publicDir: false,
  build: {
    outDir: here('../assets/building'),
    emptyOutDir: false,   // overwrite the two files in place: a running hugo server never sees the folder empty
    target: 'es2022',
    lib: { entry: here('src/pixel.js'), formats: ['es'], fileName: () => 'building.js', cssFileName: 'building' },
  },
});
