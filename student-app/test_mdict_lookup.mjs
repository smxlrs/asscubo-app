import { MDX } from 'js-mdict';
import path from 'path';

const dictPath = path.resolve('dicts/5.意大利语动词搭配大全.mdx');
console.log('Loading dict from:', dictPath);

try {
  const mdict = new MDX(dictPath);
  console.log('Mdict loaded successfully!');
  
  // Keyword list length
  console.log('Total keywords:', mdict.keywordList.length);
  
  // Print first 5 keywords
  console.log('First 5 keywords:', mdict.keywordList.slice(0, 5).map(k => k.key));
  
  // Try lookup a word
  // Wait, let's pick one of the keywords
  const testWord = mdict.keywordList[10]?.key;
  if (testWord) {
    console.log(`Looking up: "${testWord}"`);
    const result = mdict.lookup(testWord);
    console.log('Lookup result keys:', Object.keys(result));
    console.log('Lookup result definition length:', result.definition?.length);
    console.log('Lookup result definition preview:', result.definition?.substring(0, 300));
  }
} catch (e) {
  console.error('Error:', e);
}
