/* Serves a built folder for the Playwright tests. Usage: node scripts/serve.cjs <dir> <port> */
const { startServer } = require("./lib.cjs");

const [dir, port] = process.argv.slice(2);
startServer({ dir, port: Number(port) }).then((s) => process.stdout.write(`serving ${dir} at ${s.url}\n`));
