import { fetchWithDeadline } from './network';

// MyMemory limits queries to 500 UTF-8 bytes. Leave room below that limit.
const MAX_QUERY_BYTES = 420;

function utf8Length(character: string): number {
  const point = character.codePointAt(0)!;
  return point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
}

function splitForTranslation(value: string): string[] {
  const characters = Array.from(value.trim());
  const chunks: string[] = [];
  let start = 0;
  while (start < characters.length) {
    let end = start;
    let bytes = 0;
    while (end < characters.length && bytes + utf8Length(characters[end]) <= MAX_QUERY_BYTES) {
      bytes += utf8Length(characters[end++]);
    }
    // Prefer a sentence/word boundary, but always split even a single long sentence.
    if (end < characters.length) {
      for (let boundary = end - 1; boundary >= start + Math.floor((end - start) / 2); boundary--) {
        if (/[\s.!?;]/u.test(characters[boundary])) {
          end = boundary + 1;
          break;
        }
      }
    }
    const chunk = characters.slice(start, end).join('').trim();
    if (chunk) chunks.push(chunk);
    start = end;
  }
  return chunks;
}

export async function translateItalianNotice(value: string): Promise<string> {
  const chunks = splitForTranslation(value);
  if (!chunks.length) throw new Error('No notice text to translate.');
  const translated = await Promise.all(chunks.map(async (chunk) => {
    // Encode every parameter, including the language separator: a raw "|" can
    // trigger iOS URL escaping and turn existing "%20" escapes into "%2520".
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent('it|zh-CN')}`;
    const response = await fetchWithDeadline(url);
    if (!response.ok) throw new Error('Translation service is unavailable.');
    const payload = await response.json();
    const text = payload?.responseData?.translatedText;
    if (Number(payload?.responseStatus) !== 200 || typeof text !== 'string' || !text.trim()
      || /^QUERY LENGTH LIMIT EXCEEDED/i.test(text.trim())) {
      throw new Error('Translation service returned an error.');
    }
    return text.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }));
  return translated.join(' ');
}
