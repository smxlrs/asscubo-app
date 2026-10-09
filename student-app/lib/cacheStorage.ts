import * as FileSystem from 'expo-file-system/legacy';

// Only disposable files under cacheDirectory belong to this cleanup operation.
export async function getCacheSize(): Promise<number> {
  const root = FileSystem.cacheDirectory;
  if (!root) throw new Error('Cache directory is unavailable');
  const pending = [root];
  let bytes = 0;
  while (pending.length > 0) {
    const uri = pending.pop()!;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) continue; // Files may expire while we enumerate.
    if (info.isDirectory) {
      const children = await FileSystem.readDirectoryAsync(uri);
      const directory = uri.endsWith('/') ? uri : uri + '/';
      pending.push(...children.map(name => directory + name));
    } else {
      bytes += info.size || 0;
    }
  }
  return bytes;
}

export async function clearCacheDir(): Promise<void> {
  const root = FileSystem.cacheDirectory;
  if (!root) throw new Error('Cache directory is unavailable');
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists) return;
  const children = await FileSystem.readDirectoryAsync(root);
  const directory = root.endsWith('/') ? root : root + '/';
  let failed = false;
  for (const name of children) {
    try {
      await FileSystem.deleteAsync(directory + name, { idempotent: true });
    } catch {
      failed = true;
    }
  }
  if (failed) throw new Error('Some cached files could not be removed');
}
