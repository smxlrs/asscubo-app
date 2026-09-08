type SecretKeyMap = Record<string, string>;

function readSecretKeyMap(): SecretKeyMap {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0),
    );
  } catch (error) {
    console.error("SUPABASE_SECRET_KEYS is not valid JSON.", error);
    return {};
  }
}

export function getSupabaseSecretKeys(): string[] {
  const keyMap = readSecretKeyMap();
  const preferred = keyMap.default;
  const keys = Object.values(keyMap);
  return preferred ? [preferred, ...keys.filter((key) => key !== preferred)] : keys;
}

export function getSupabaseAdminKey(): string {
  const key = getSupabaseSecretKeys()[0];
  if (!key) throw new Error("No Supabase secret key is available to this Edge Function.");
  return key;
}

function securelyEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export function isInternalSupabaseRequest(request: Request): boolean {
  const secretKeys = getSupabaseSecretKeys();
  const apiKey = request.headers.get("apikey")?.trim();
  return Boolean(apiKey && secretKeys.some((key) => securelyEqual(apiKey, key)));
}
