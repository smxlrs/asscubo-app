import { MDX } from 'js-mdict';
import fs from 'fs';
import path from 'path';

const dicts = [
  { id: 'dict_1', name: '1.[外研社]现代意汉汉意词典IT.mdx' },
  { id: 'dict_2', name: '2.[外研社]现代意汉汉意词典CN.mdx' },
  { id: 'dict_3', name: '3.意汉词典[45893].mdx' },
  { id: 'dict_4', name: '4.意汉汉意词典[109907].mdx' },
  { id: 'dict_5', name: '5.意大利语动词搭配大全.mdx' },
  { id: 'dict_6', name: '6.意大利语动词变位词典[8339].mdx' },
  { id: 'dict_7', name: '7.意大利语动词变位反查词典.mdx' },
  { id: 'dict_8', name: '8.意大利语同义词辨析词典.mdx' },
];

const word = 'andare';
console.log(`Searching for "${word}" across all dicts...\n`);

for (const d of dicts) {
  const dictPath = path.resolve('assets/dicts', d.name);
  if (!fs.existsSync(dictPath)) {
    console.log(`File does not exist: ${dictPath}`);
    continue;
  }
  
  try {
    const bytes = new Uint8Array(fs.readFileSync(dictPath));
    const mdx = new MDX(dictPath);
    const res = mdx.lookup(word);
    if (res && res.definition) {
      console.log(`  -> Found in ${d.id}! Definition length: ${res.definition.length} chars.`);
      console.log(`     Preview: ${res.definition.substring(0, 100)}`);
    } else {
      console.log(`  -> Not found in ${d.id}`);
    }
  } catch (e) {
    console.error(`  -> ERROR loading/searching ${d.id}:`, e.message);
  }
}
