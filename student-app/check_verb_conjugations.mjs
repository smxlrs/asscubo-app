import { MDX } from 'js-mdict';
import path from 'path';

const dictPath = path.resolve('dicts/6.意大利语动词变位词典[8339].mdx');

try {
  const mdict = new MDX(dictPath);
  console.log('Total keywords:', mdict.keywordList.length);
  
  // Look up a few words
  const words = ['parlare', 'mangiare', 'essere', 'avere'];
  for (const w of words) {
    try {
      const res = mdict.lookup(w);
      console.log(`Word: "${w}"`);
      console.log(`Definition length: ${res.definition?.length} chars`);
      console.log(`Definition preview:`, res.definition?.substring(0, 500));
      console.log('-----------------------------');
    } catch (e) {
      console.log(`Word "${w}" not found:`, e.message);
    }
  }
} catch (e) {
  console.error(e);
}
