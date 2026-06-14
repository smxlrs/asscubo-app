import { DatabaseSync } from 'node:sqlite';
import { MDX } from 'js-mdict';
import fs from 'fs';
import path from 'path';

const dictsDir = path.resolve('dicts');
const assetsDir = path.resolve('assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
}
const dbPath = path.join(assetsDir, 'dicts.db');

// Accent normalization helper for Italian search friendliness
function cleanWord(word) {
  if (!word) return '';
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function main() {
  console.log('Starting dictionary SQLite builder...');
  
  // Delete existing database file if exists to start fresh
  if (fs.existsSync(dbPath)) {
    console.log('Deleting existing dicts.db...');
    fs.unlinkSync(dbPath);
  }
  
  const db = new DatabaseSync(dbPath);
  console.log('SQLite database created/opened at:', dbPath);
  
  // Create table and indexes
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dict_id TEXT NOT NULL,
      word TEXT NOT NULL,
      word_clean TEXT NOT NULL,
      definition TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entries_word_clean ON entries(word_clean);
  `);
  console.log('Database table and indexes created.');
  
  const insertStmt = db.prepare(`
    INSERT INTO entries (dict_id, word, word_clean, definition)
    VALUES (?, ?, ?, ?)
  `);
  
  const mdxFiles = fs.readdirSync(dictsDir)
    .filter(f => f.endsWith('.mdx'))
    .sort();
    
  console.log(`Found ${mdxFiles.length} dictionary files to process.`);
  
  for (const file of mdxFiles) {
    const filePath = path.join(dictsDir, file);
    console.log(`\nProcessing: ${file}...`);
    
    const startLoad = Date.now();
    const mdict = new MDX(filePath);
    console.log(`Loaded ${mdict.keywordList.length} keys in ${Date.now() - startLoad}ms.`);
    
    // Extract dictionary ID from filename prefix (e.g. "1" from "1.[外研社]...")
    const match = file.match(/^(\d+)\./);
    const dictId = match ? `dict_${match[1]}` : file.replace('.mdx', '');
    
    console.log(`Writing entries to database for ${dictId}...`);
    const startWrite = Date.now();
    
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    let count = 0;
    for (const entry of mdict.keywordList) {
      const word = entry.keyText;
      if (!word) continue;
      
      // Lookup the definition
      try {
        const res = mdict.lookup(word);
        const definition = res.definition || '';
        const wClean = cleanWord(word);
        
        insertStmt.run(dictId, word, wClean, definition);
        count++;
        
        if (count % 20000 === 0) {
          console.log(`  Inserted ${count} entries...`);
        }
      } catch (err) {
        console.warn(`  Failed to lookup "${word}" in ${file}:`, err.message);
      }
    }
    
    // Commit transaction
    db.exec('COMMIT');
    
    console.log(`Finished ${file}: wrote ${count} entries in ${Date.now() - startWrite}ms.`);
  }
  
  console.log('\nAll dictionaries imported successfully!');
  
  // Verify entry count
  const countRow = db.prepare('SELECT count(*) as total FROM entries').get();
  console.log(`Total entries in Database: ${countRow.total}`);
}

main().catch(err => {
  console.error('Builder crashed:', err);
});
