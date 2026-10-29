/*
 * better-sqlite3 is a native module and its binary must match the ABI of the
 * runtime loading it. Plain Node and Electron use different ABIs, so we keep
 * one copy per runtime and swap the active binary before launching.
 *
 *   node scripts/use-abi.js node       -> for `npm start` (browser mode)
 *   node scripts/use-abi.js electron   -> for `npm run desktop` / packaging
 */
const fs = require("fs");
const path = require("path");

const which = process.argv[2];

if (which !== "node" && which !== "electron") {
  console.error("usage: node scripts/use-abi.js <node|electron>");
  process.exit(1);
}

const buildDir = path.join(__dirname, "..", "node_modules", "better-sqlite3", "build");
const target = path.join(buildDir, "Release", "better_sqlite3.node");
const source = path.join(buildDir, `Release-${which}`, "better_sqlite3.node");

if (!fs.existsSync(source)) {
  console.error(
    `missing ${source}\n` +
      `run: cd node_modules/better-sqlite3 && node ../../node_modules/prebuild-install/bin.js -r ${
        which === "electron" ? "electron -t 42.0.0" : "node"
      } -a x64`
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`[abi] better-sqlite3 binary set to ${which} build`);
