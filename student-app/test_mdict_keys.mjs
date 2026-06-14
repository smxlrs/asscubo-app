import { MDX } from 'js-mdict';
import path from 'path';

const dictPath = path.resolve('dicts/5.意大利语动词搭配大全.mdx');

try {
  const mdict = new MDX(dictPath);
  console.log('Total keywords:', mdict.keywordList.length);
  
  // Print keywordList[10]
  console.log('keywordList[10] keys/values:', JSON.stringify(mdict.keywordList[10]));
  
  // Let's print a few methods/properties on keywordList[10]
  const entry = mdict.keywordList[10];
  if (entry) {
    console.log('keys on entry:', Object.keys(entry));
    console.log('proto keys on entry:', Object.getOwnPropertyNames(Object.getPrototypeOf(entry)));
    // Maybe it has .toString() or .key or .word?
    console.log('entry.toString():', entry.toString());
  }
} catch (e) {
  console.error('Error:', e);
}
