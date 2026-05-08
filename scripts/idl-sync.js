#!/usr/bin/env node
/**
 * IDL Sync Script
 * 
 * Copies the generated IDL from the Anchor program to the SDK and app packages.
 * Run after `anchor build` to ensure SDK and app have the latest IDL.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const GENERATED_IDL_SOURCE = path.join(ROOT_DIR, 'programs/sable/target', 'idl', 'sable.json');
const SDK_IDL_DIR = path.join(ROOT_DIR, 'packages', 'sdk', 'idl');
const APP_IDL_DIR = path.join(ROOT_DIR, 'app', 'src', 'idl');
const CHECKED_IN_IDL_SOURCE = path.join(SDK_IDL_DIR, 'sable.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

function copyIdl(source, dest) {
  if (!fs.existsSync(source)) {
    console.error(`IDL not found at ${source}`);
    console.error('Make sure to run `anchor build` first.');
    process.exit(1);
  }

  ensureDir(path.dirname(dest));
  fs.copyFileSync(source, dest);
  console.log(`Copied IDL to ${dest}`);
}

function main() {
  console.log('Syncing IDL...');
  
  try {
    const source = fs.existsSync(GENERATED_IDL_SOURCE)
      ? GENERATED_IDL_SOURCE
      : CHECKED_IN_IDL_SOURCE;

    if (source === CHECKED_IN_IDL_SOURCE) {
      console.warn(
        `Generated IDL not found at ${GENERATED_IDL_SOURCE}; syncing from checked-in SDK IDL.`
      );
      console.warn('Run `anchor build` with the Anchor CLI installed to regenerate IDL from Rust.');
    }

    // Copy to SDK
    copyIdl(source, path.join(SDK_IDL_DIR, 'sable.json'));
    
    // Copy to App
    copyIdl(source, path.join(APP_IDL_DIR, 'sable.json'));
    
    console.log('IDL sync complete!');
  } catch (error) {
    console.error('Error syncing IDL:', error.message);
    process.exit(1);
  }
}

main();
