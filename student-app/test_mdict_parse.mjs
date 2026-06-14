import { MDX } from 'js-mdict';
import path from 'path';

const dictPath = path.resolve('dicts/5.意大利语动词搭配大全.mdx');
console.log('Loading dict from:', dictPath);

try {
  const mdict = new MDX(dictPath);
  console.log('Mdict loaded successfully!');
  
  // Print properties/methods of MDX instance
  console.log('Mdict keys:', Object.keys(mdict));
  const proto = Object.getPrototypeOf(mdict);
  console.log('Mdict prototype methods:', Object.getOwnPropertyNames(proto));
  
  // Let's try lookup or search or keys
  // Let's search for some keys
  if (typeof mdict.lookup === 'function') {
    console.log('Has lookup function!');
  }
} catch (e) {
  console.error('Error loading dict:', e);
}
