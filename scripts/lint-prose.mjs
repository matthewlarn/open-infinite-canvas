/*
 * Checks the writing rules that a person cannot be trusted to keep by eye.
 *
 * README.md: no em dashes, no semicolons and no curly quotes, anywhere in the file.
 * Every other Markdown file: no em dashes and no curly quotes outside code.
 * Every file in the demo: no filler text.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const SKIP = new Set(["node_modules", "dist", "dist-react18", ".git", "results", "test-results"]);
const problems = [];

function walk(dir, visit) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, visit);
    else visit(path);
  }
}

const EM = /[—–]/;
const CURLY = /[‘’“”]/;

walk(root, (path) => {
  const rel = relative(root, path);
  if (path.endsWith(".md")) {
    const strict = rel === "README.md";
    let fenced = false;
    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (line.startsWith("```")) fenced = !fenced;
        const prose = strict || !fenced;
        if (prose && EM.test(line)) problems.push(`${rel}:${i + 1} has a dash that should be a comma or a full stop`);
        if (prose && CURLY.test(line)) problems.push(`${rel}:${i + 1} has a curly quote`);
        if (strict && line.includes(";")) problems.push(`${rel}:${i + 1} has a semicolon`);
      });
  }
  if (rel.startsWith(join("apps", "demo", "src")) && /\.(ts|tsx|css|html)$/.test(path)) {
    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/lorem ipsum|\bacme\b|jane doe|john doe|example\.com|123 main st/i.test(line)) problems.push(`${rel}:${i + 1} has filler text`);
      });
  }
});

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}.`);
  process.exit(1);
}
console.log("Prose rules hold.");
