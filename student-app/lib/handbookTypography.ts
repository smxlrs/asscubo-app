export const HANDBOOK_TEXT_BREAK_PROPS = {
  textBreakStrategy: 'highQuality' as const,
  android_hyphenationFrequency: 'full' as const,
  lineBreakStrategyIOS: 'standard' as const,
};

const hyphenateLatinWord = (word: string): string => {
  if (word.length <= 4) return word;

  const isVowel = (character: string) => /[aeiouyàèéìòùAEIOUYÀÈÉÌÒÙ]/.test(character);
  const isConsonant = (character: string) => /[a-zA-Z]/.test(character) && !isVowel(character);
  const characters = word.split('');
  const result: string[] = [];

  for (let index = 0; index < characters.length; index += 1) {
    result.push(characters[index]);
    if (index >= characters.length - 2) continue;

    const current = characters[index];
    const next = characters[index + 1];
    const afterNext = characters[index + 2];
    const currentLower = current.toLowerCase();
    const nextLower = next.toLowerCase();

    if (isConsonant(current) && isConsonant(next) && currentLower === nextLower) {
      result.push('\u00AD');
      continue;
    }
    if (currentLower === 'c' && nextLower === 'q') {
      result.push('\u00AD');
      continue;
    }

    if (isConsonant(current) && isConsonant(next)) {
      const isDigraph = (currentLower === 'c' && nextLower === 'h')
        || (currentLower === 'g' && nextLower === 'h')
        || (currentLower === 'g' && nextLower === 'n')
        || (currentLower === 'g' && nextLower === 'l')
        || (currentLower === 's' && nextLower === 'c');
      const isConsonantPair = 'bcdfghpqrtv'.includes(currentLower) && 'lr'.includes(nextLower);
      const isSGroup = nextLower === 's' && isConsonant(afterNext);
      const startsWithS = currentLower === 's' && isConsonant(nextLower);
      if (!isDigraph && !isConsonantPair && !isSGroup && !startsWithS) {
        result.push('\u00AD');
        continue;
      }
    }

    if (isVowel(current) && isConsonant(next) && isVowel(afterNext)) {
      result.push('\u00AD');
      continue;
    }

    const nextPairIsDigraph = (nextLower === 'c' && afterNext.toLowerCase() === 'h')
      || (nextLower === 'g' && afterNext.toLowerCase() === 'h')
      || (nextLower === 'g' && afterNext.toLowerCase() === 'n')
      || (nextLower === 'g' && afterNext.toLowerCase() === 'l')
      || (nextLower === 's' && afterNext.toLowerCase() === 'c');
    if (isVowel(current) && nextPairIsDigraph && index < characters.length - 3 && isVowel(characters[index + 3])) {
      result.push('\u00AD');
      continue;
    }

    if (isVowel(current) && isVowel(next)) {
      const isDiphthong = ['i', 'u'].includes(currentLower) || ['i', 'u'].includes(nextLower);
      if (!isDiphthong && currentLower !== nextLower) result.push('\u00AD');
    }
  }

  return result.join('');
};

export const hyphenateHandbookText = (text: string): string => text.replace(
  /(?:https?:\/\/|www\.)[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|[a-zA-ZàèéìòùÀÈÉÌÒÙ']{3,}/g,
  token => {
    if (/^(?:https?:\/\/|www\.)/i.test(token) || token.includes('@')) return token;
    return token.includes("'")
      ? token.split("'").map(part => hyphenateLatinWord(part)).join("'")
      : hyphenateLatinWord(token);
  },
);

// A single newline is a soft break in Markdown. Keep deliberate paragraph indentation fixed.
export const normalizeHandbookSoftBreaks = (text: string): string => {
  const leading = text.match(/^[ \t\u3000]+/)?.[0] ?? '';
  const fixedLeading = leading.replace(/\t/g, '    ').replace(/ /g, '\u00A0');
  return fixedLeading + text.slice(leading.length).replace(/[ \t]*\n[ \t]*/g, ' ');
};
