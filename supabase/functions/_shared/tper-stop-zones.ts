// Official fermate.csv uses codice (stop ID) and codice_zona (fare zone ID).
// Unknown/zero/conflicting values must never turn into a guessed fare zone.
export function stopZones(rows: Record<string, string>[]): Map<string, string | null> {
  const zones = new Map<string, string | null>();
  for (const row of rows) {
    const code = row.codice?.trim();
    if (!code) continue;
    const raw = row.codice_zona?.trim() || '';
    const zone = /^[1-9][0-9]*$/.test(raw) ? raw : null;
    zones.set(code, zones.has(code) && zones.get(code) !== zone ? null : zone);
  }
  return zones;
}
