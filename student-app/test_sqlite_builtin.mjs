try {
  const sqlite = await import('node:sqlite');
  console.log('Built-in node:sqlite is available!', Object.keys(sqlite));
} catch (e) {
  console.log('Built-in node:sqlite is NOT available:', e.message);
}
