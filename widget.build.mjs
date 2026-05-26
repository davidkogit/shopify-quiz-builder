/**
 * esbuild build script for the QuizKit storefront widget.
 *
 * Produces a self-contained IIFE bundle at public/widget/bundle.js
 * that can be dropped into any page with a <script> tag.
 *
 * Usage: node widget.build.mjs
 */

import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const OUT_DIR = resolve(__dirname, "public/widget");
const JS_OUT = resolve(OUT_DIR, "bundle.js");
const CSS_SRC = resolve(__dirname, "src/components/widget/widget.css");
const CSS_OUT = resolve(OUT_DIR, "bundle.css");

// Ensure the output directory exists
mkdirSync(OUT_DIR, { recursive: true });

// Build the self-contained IIFE JS bundle
async function buildJS() {
  const start = Date.now();
  try {
    await esbuild.build({
      entryPoints: [resolve(__dirname, "src/widget/index.ts")],
      bundle: true,
      outfile: JS_OUT,
      format: "iife",
      globalName: "QuizKit",
      minify: true,
      target: "es2017",
      sourcemap: true,
      // Bundle everything inline — no externals (React/ReactDOM included)
      external: [],
      // CSS imports in the component tree are handled via <link> tag;
      // we tell esbuild to treat them as no-ops so the bundle stays JS-only.
      loader: { ".css": "empty" },
      logLevel: "info",
    });
    const elapsed = Date.now() - start;
    console.log(`✅ Widget JS built → ${JS_OUT} (${elapsed}ms)`);
  } catch (err) {
    console.error("❌ Widget JS build failed:", err);
    process.exit(1);
  }
}

// Copy standalone CSS
function copyCSS() {
  try {
    copyFileSync(CSS_SRC, CSS_OUT);
    console.log(`✅ Widget CSS copied → ${CSS_OUT}`);
  } catch (err) {
    console.error("❌ CSS copy failed:", err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
await buildJS();
copyCSS();
