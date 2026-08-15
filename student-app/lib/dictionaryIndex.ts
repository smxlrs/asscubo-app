import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import {
  importDatabaseFromAssetAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';
import { IndexedMDXReader, type IndexedMdxStructure } from './mdict/mdictReader';

const INDEX_DATABASE_NAME = 'dictionary-index-v1.db';
const IMPORTED_INDEX_DATABASE_NAME = 'imported-dictionary-index-v1.db';
const INDEX_DATABASE_ASSET = require('../assets/dicts/dictionary-index-v1.db');
const DICTIONARY_DIRECTORY = `${FileSystem.documentDirectory}dicts`;
const BUNDLED_DICTIONARY_IDS = new Set(
  Array.from({ length: 8 }, (_, index) => `dict_${index + 1}`)
);

type IndexMetadataRow = {
  dict_id: string;
  source_size: number;
  encoding: string;
  encrypt: number;
  record_block_start_offset: number;
  record_info_json: string;
};

type IndexEntryRow = {
  key_text: string;
  record_start_offset: number;
  record_end_offset: number;
};

let databasePromise: Promise<SQLiteDatabase | null> | null = null;
let importedDatabasePromise: Promise<SQLiteDatabase | null> | null = null;
const readerPromises: Record<string, Promise<IndexedMDXReader | null>> = {};

export function hasBundledDictionaryIndex(dictId: string): boolean {
  return BUNDLED_DICTIONARY_IDS.has(dictId);
}

export async function warmBundledDictionaryIndex(dictIds: string[]): Promise<void> {
  if (dictIds.some(hasBundledDictionaryIndex)) {
    await getIndexDatabase();
  }
}

async function getIndexDatabase(): Promise<SQLiteDatabase | null> {
  if (databasePromise) return databasePromise;

  databasePromise = (async () => {
    try {
      await importDatabaseFromAssetAsync(INDEX_DATABASE_NAME, {
        assetId: INDEX_DATABASE_ASSET,
      });
      return await openDatabaseAsync(INDEX_DATABASE_NAME);
    } catch (error) {
      console.warn('[DictionaryIndex] Unable to open bundled index:', error);
      return null;
    }
  })();

  return databasePromise;
}

async function getImportedIndexDatabase(): Promise<SQLiteDatabase | null> {
  if (importedDatabasePromise) return importedDatabasePromise;

  importedDatabasePromise = (async () => {
    try {
      const database = await openDatabaseAsync(IMPORTED_INDEX_DATABASE_NAME);
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS dictionary_meta (
          dict_id TEXT PRIMARY KEY NOT NULL,
          source_size INTEGER NOT NULL,
          encoding TEXT NOT NULL,
          encrypt INTEGER NOT NULL,
          record_block_start_offset INTEGER NOT NULL,
          record_info_json TEXT NOT NULL,
          entry_count INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS dictionary_entries (
          dict_id TEXT NOT NULL,
          normalized_key TEXT NOT NULL,
          entry_order INTEGER NOT NULL,
          key_text TEXT NOT NULL,
          record_start_offset INTEGER NOT NULL,
          record_end_offset INTEGER NOT NULL,
          PRIMARY KEY (dict_id, normalized_key, entry_order)
        ) WITHOUT ROWID;
      `);
      return database;
    } catch (error) {
      console.warn('[DictionaryIndex] Unable to open imported index:', error);
      return null;
    }
  })();

  return importedDatabasePromise;
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export class DictionaryIndexCancelledError extends Error {
  constructor() {
    super('Dictionary import was cancelled.');
    this.name = 'DictionaryIndexCancelledError';
  }
}

export type DictionaryIndexProgress = {
  completed: number;
  total: number;
};

export type DictionaryIndexBuildOptions = {
  onProgress?: (progress: DictionaryIndexProgress) => void;
  shouldCancel?: () => boolean;
};

export async function buildImportedDictionaryIndex(
  dictId: string,
  sourceSize: number,
  mdx: any,
  options: DictionaryIndexBuildOptions = {}
): Promise<void> {
  const database = await getImportedIndexDatabase();
  if (!database) throw new Error('Unable to create the local dictionary index.');

  // React Native's MDX reader intentionally leaves key blocks lazy. Build the
  // persistent index once at import time instead of paying this cost on lookup.
  mdx._readKeyBlocks();
  const entries = mdx.keywordList as Array<{
    keyText: string;
    recordStartOffset: number;
    recordEndOffset: number;
  }>;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('The dictionary does not contain readable word entries.');
  }
  options.onProgress?.({ completed: 0, total: entries.length });

  await database.execAsync('BEGIN IMMEDIATE TRANSACTION');
  const entryStatement = await database.prepareAsync(
    `INSERT INTO dictionary_entries (
      dict_id, normalized_key, entry_order, key_text, record_start_offset, record_end_offset
    ) VALUES (?, ?, ?, ?, ?, ?)`
  );

  try {
    await database.runAsync('DELETE FROM dictionary_entries WHERE dict_id = ?', [dictId]);
    await database.runAsync('DELETE FROM dictionary_meta WHERE dict_id = ?', [dictId]);
    for (let index = 0; index < entries.length; index += 1) {
      if (options.shouldCancel?.()) {
        throw new DictionaryIndexCancelledError();
      }
      const entry = entries[index];
      await entryStatement.executeAsync(
        dictId,
        normalizeKey(entry.keyText),
        index,
        entry.keyText,
        entry.recordStartOffset,
        entry.recordEndOffset
      );
      // Yield periodically so an unusually large import does not starve gestures.
      if ((index + 1) % 100 === 0 || index === entries.length - 1) {
        options.onProgress?.({ completed: index + 1, total: entries.length });
      }
      if (index > 0 && index % 250 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    await database.runAsync(
      `INSERT INTO dictionary_meta (
        dict_id, source_size, encoding, encrypt, record_block_start_offset, record_info_json, entry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        dictId,
        sourceSize,
        mdx.meta.encoding,
        mdx.meta.encrypt,
        mdx._recordBlockStartOffset,
        JSON.stringify(mdx.recordInfoList),
        entries.length,
      ]
    );
    await database.execAsync('COMMIT');
  } catch (error) {
    await database.execAsync('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await entryStatement.finalizeAsync();
  }
}

export async function removeImportedDictionaryIndex(dictId: string): Promise<void> {
  const database = await getImportedIndexDatabase();
  if (!database) return;
  await database.runAsync('DELETE FROM dictionary_entries WHERE dict_id = ?', [dictId]);
  await database.runAsync('DELETE FROM dictionary_meta WHERE dict_id = ?', [dictId]);
  // Delete alone leaves SQLite free pages on disk. Compact the database and
  // truncate its WAL so removing a large dictionary releases its storage.
  await database.execAsync('PRAGMA wal_checkpoint(TRUNCATE); VACUUM;');
  delete readerPromises[dictId];
}

export async function hasPersistentDictionaryIndex(dictId: string): Promise<boolean> {
  if (hasBundledDictionaryIndex(dictId)) return true;
  const database = await getImportedIndexDatabase();
  if (!database) return false;
  const metadata = await database.getFirstAsync<{ dict_id: string }>(
    'SELECT dict_id FROM dictionary_meta WHERE dict_id = ?',
    [dictId]
  );
  return !!metadata;
}

async function getReader(dictId: string, metadata: IndexMetadataRow): Promise<IndexedMDXReader | null> {
  if (!readerPromises[dictId]) {
    readerPromises[dictId] = (async () => {
      try {
        const bytes = await new File(`${DICTIONARY_DIRECTORY}/${dictId}.mdx`).bytes();
        if (bytes.length !== metadata.source_size) {
          console.warn(
            `[DictionaryIndex] ${dictId} is ${bytes.length} bytes, expected ${metadata.source_size}; using the compatible reader.`
          );
          return null;
        }
        const structure: IndexedMdxStructure = {
          encoding: metadata.encoding,
          encrypt: metadata.encrypt,
          recordBlockStartOffset: metadata.record_block_start_offset,
          recordInfoList: JSON.parse(metadata.record_info_json),
        };
        return new IndexedMDXReader(bytes, structure);
      } catch (error) {
        console.warn(`[DictionaryIndex] Unable to open ${dictId}:`, error);
        return null;
      }
    })();
  }
  return readerPromises[dictId];
}

export type IndexedDefinitionResult = {
  handled: boolean;
  definition: string | null;
};

export async function getIndexedDefinition(
  dictId: string,
  normalizedWord: string
): Promise<IndexedDefinitionResult> {
  const database = hasBundledDictionaryIndex(dictId)
    ? await getIndexDatabase()
    : await getImportedIndexDatabase();
  if (!database) return { handled: false, definition: null };

  const metadata = await database.getFirstAsync<IndexMetadataRow>(
    `SELECT dict_id, source_size, encoding, encrypt, record_block_start_offset, record_info_json
     FROM dictionary_meta WHERE dict_id = ?`,
    [dictId]
  );
  if (!metadata) return { handled: false, definition: null };

  const entry = await database.getFirstAsync<IndexEntryRow>(
    `SELECT key_text, record_start_offset, record_end_offset
     FROM dictionary_entries
     WHERE dict_id = ? AND normalized_key = ?
     ORDER BY entry_order
     LIMIT 1`,
    [dictId, normalizedWord]
  );
  if (!entry) return { handled: true, definition: null };

  const reader = await getReader(dictId, metadata);
  if (!reader) return { handled: false, definition: null };
  try {
    return {
      handled: true,
      definition: reader.fetch({
        keyText: entry.key_text,
        recordStartOffset: entry.record_start_offset,
        recordEndOffset: entry.record_end_offset,
      }).definition,
    };
  } catch (error) {
    // A stale or partially copied MDX must never break a dictionary lookup.
    console.warn(`[DictionaryIndex] ${dictId} index read failed; using the compatible reader:`, error);
    return { handled: false, definition: null };
  }
}

export async function getIndexedSuggestions(
  normalizedPrefix: string,
  dictIds: string[]
): Promise<string[]> {
  if (!normalizedPrefix || dictIds.length === 0) return [];

  const bundledIds = dictIds.filter(hasBundledDictionaryIndex);
  const importedIds = dictIds.filter((dictId) => !hasBundledDictionaryIndex(dictId));
  const queryRows = async (database: SQLiteDatabase | null, ids: string[]) => {
    if (!database || ids.length === 0) return [] as Array<{ key_text: string }>;
    const placeholders = ids.map(() => '?').join(', ');
    return database.getAllAsync<{ key_text: string }>(
      `SELECT key_text FROM dictionary_entries
       WHERE dict_id IN (${placeholders})
         AND normalized_key >= ?
         AND normalized_key < ?
       ORDER BY length(key_text), key_text
       LIMIT 60`,
      [...ids, normalizedPrefix, `${normalizedPrefix}\uffff`]
    );
  };
  const [bundledRows, importedRows] = await Promise.all([
    queryRows(await getIndexDatabase(), bundledIds),
    queryRows(await getImportedIndexDatabase(), importedIds),
  ]);
  return [...bundledRows, ...importedRows].map((row) => row.key_text);
}
