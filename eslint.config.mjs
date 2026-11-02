// npm run lint: ESLint's recommended rules over the site's own JavaScript. The scripts are CommonJS on Node; the
// building (web3d/src/) is bundled ES modules; assets/js/ are plain browser scripts, minified by Hugo.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["public/", "resources/", "assets/building/", "static/vendor/", "node_modules/", ".tools/", "artifacts/"] },
  js.configs.recommended,
  {
    files: ["scripts/**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node, ...globals.browser } },   // and the browser, for what they run in the page
  },
  {
    files: ["web3d/**/*.{js,mjs}", "assets/js/**/*.js"],
    languageOptions: { sourceType: "module", globals: globals.browser },
  },
  {
    files: ["web3d/vite.config.mjs", "eslint.config.mjs"],
    languageOptions: { globals: globals.node },
  },
];
