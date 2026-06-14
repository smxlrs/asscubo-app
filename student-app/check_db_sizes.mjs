import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const dbPath = path.resolve('assets/dicts.db');

try {
  const db = new DatabaseSync(dbPath);
  
  console.log('Querying database stats...');
  
  const stats = db.prepare(`
    SELECT 
      dict_id, 
      count(*) as total_entries,
      avg(length(word)) as avg_word_len,
      avg(length(definition)) as avg_def_len,
      sum(length(definition)) as total_def_bytes
    FROM entries
    GROUP BY dict_id
  `).all();
  
  console.log('\n--- Database Stats by Dictionary ---');
  stats.forEach(row => {
    console.log(`Dict ID: ${row.dict_id}`);
    console.log(`  Total Entries: ${row.total_entries}`);
    console.log(`  Avg Word Length: ${row.avg_word_len.toFixed(1)} chars`);
    console.log(`  Avg Definition Length: ${row.avg_def_len.toFixed(1)} chars`);
    console.log(`  Total Definition Size: ${(row.total_def_bytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log('------------------------------------');
  });
} catch (e) {
  console.error(e);
}
