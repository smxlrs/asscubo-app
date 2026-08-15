import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MDX } from 'js-mdict';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dictionaryDir = join(projectRoot, 'assets', 'dicts');
const outputPath = join(dictionaryDir, 'dictionary-index-v1.db');
const dictionaryIds = Array.from({ length: 8 }, (_, index) => `dict_${index + 1}`);

function normalizeKey(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

if (existsSync(outputPath)) {
  rmSync(outputPath);
}
mkdirSync(dictionaryDir, { recursive: true });

const database = new DatabaseSync(outputPath);
database.exec(`
  PRAGMA journal_mode = OFF;
  PRAGMA synchronous = OFF;
  CREATE TABLE dictionary_meta (
    dict_id TEXT PRIMARY KEY NOT NULL,
    source_size INTEGER NOT NULL,
    source_sha256 TEXT NOT NULL,
    encoding TEXT NOT NULL,
    encrypt INTEGER NOT NULL,
    record_block_start_offset INTEGER NOT NULL,
    record_info_json TEXT NOT NULL,
    entry_count INTEGER NOT NULL
  );
  CREATE TABLE dictionary_entries (
    dict_id TEXT NOT NULL,
    normalized_key TEXT NOT NULL,
    entry_order INTEGER NOT NULL,
    key_text TEXT NOT NULL,
    record_start_offset INTEGER NOT NULL,
    record_end_offset INTEGER NOT NULL,
    PRIMARY KEY (dict_id, normalized_key, entry_order)
  ) WITHOUT ROWID;
`);

const insertMeta = database.prepare(
  `INSERT INTO dictionary_meta (
    dict_id, source_size, source_sha256, encoding, encrypt,
    record_block_start_offset, record_info_json, entry_count
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertEntry = database.prepare(
  `INSERT INTO dictionary_entries (
    dict_id, normalized_key, entry_order, key_text, record_start_offset, record_end_offset
  ) VALUES (?, ?, ?, ?, ?, ?)`
);

for (const dictId of dictionaryIds) {
  const sourcePath = join(dictionaryDir, `${dictId}.mdx`);
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing dictionary source: ${sourcePath}`);
  }

  const startedAt = Date.now();
  const sourceStats = statSync(sourcePath);
  const mdx = new MDX(sourcePath);
  let entryCount = 0;

  database.exec('BEGIN');
  try {
    mdx.keywordList.forEach((item, entryOrder) => {
      insertEntry.run(
        dictId,
        normalizeKey(item.keyText),
        entryOrder,
        item.keyText,
        item.recordStartOffset,
        item.recordEndOffset
      );
      entryCount += 1;
    });
    insertMeta.run(
      dictId,
      sourceStats.size,
      sha256(sourcePath),
      mdx.meta.encoding,
      mdx.meta.encrypt,
      mdx._recordBlockStartOffset,
      JSON.stringify(mdx.recordInfoList),
      entryCount
    );
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  console.log(`${dictId}: ${entryCount} entries in ${Date.now() - startedAt}ms`);
}

database.exec(`
  VACUUM;
`);
database.close();

console.log(`Created ${basename(outputPath)}`);
