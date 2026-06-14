import { MDX } from 'js-mdict';
import path from 'path';

const dictPath = path.resolve('dicts/7.意大利语动词变位反查词典.mdx');

try {
  const mdict = new MDX(dictPath);
  console.log('Total keywords:', mdict.keywordList.length);
  
  // Look up a few words
  const words = ['parlavo', 'parlato', 'siamo', 'mangiato'];
  for (const w of words) {
    try {
      const res = mdict.lookup(w);
      console.log(`Word: "${w}"`);
      console.log(`Definition length: ${res.definition?.length}`);
      console.log(`Definition:`, res.definition);
      console.log('-----------------------------');
    } catch (e) {
      console.log(`Word "${w}" not found:`, e.message);
    }
  }
} catch (e) {
  console.error(e);
}
