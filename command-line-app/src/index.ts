#!/usr/bin/env node

import parseOptions from "./utils/parse-options";

async function main() {
  try {
    const args = process.argv.slice(2);
    const options = parseOptions(args);
  } catch (err) {
    console.error(err.message);
  }
}

main();
