import { MDX } from 'js-mdict';
import fs from 'fs';
import path from 'path';

const dictsDir = path.resolve('dicts');

async function main() {
  const files = fs.readdirSync(dictsDir).filter(f => f.endsWith('.mdx')).sort();
  console.log(`Found ${files.length} MDX files:`);
  
  for (const file of files) {
    const fullPath = path.join(dictsDir, file);
    try {
      const start = Date.now();
      const mdict = new MDX(fullPath);
      const elapsed = Date.now() - start;
      console.log(`- File: ${file}`);
      console.log(`  Encoding: ${mdict.meta.encoding}`);
      console.log(`  Header Encoding: ${mdict.header.Encoding}`);
      console.log(`  Keywords: ${mdict.keywordList.length}`);
      console.log(`  Load time: ${elapsed}ms`);
      const sample = mdict.keywordList.slice(100, 105).map(k => k.keyText);
      console.log(`  Sample keys (100-104):`, sample);
    } catch (e) {
      console.error(`- Error loading ${file}:`, e);
    }
  }
}

main();
