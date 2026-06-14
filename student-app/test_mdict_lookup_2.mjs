import { MDX } from 'js-mdict';
import path from 'path';

const dictPath = path.resolve('dicts/5.意大利语动词搭配大全.mdx');

try {
  const mdict = new MDX(dictPath);
  console.log('Mdict loaded!');
  
  const testWord = 'abbellirsi';
  console.log(`Looking up: "${testWord}"`);
  
  const result = mdict.lookup(testWord);
  console.log('Result type:', typeof result);
  console.log('Result keys:', Object.keys(result));
  console.log('Result definition length:', result.definition?.length);
  console.log('Result definition:', result.definition);
} catch (e) {
  console.error('Error:', e);
}
