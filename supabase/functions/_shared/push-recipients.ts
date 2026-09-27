// Service-role sends honor the same device preferences as manual sends.
export async function getDeliveryTokens(client: any): Promise<string[]> {
  const tokens = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.rpc('push_delivery_tokens', { p_offset: offset, p_limit: 500 });
    if (error) {
      // Import is already committed. Fail closed for delivery without claiming import failed.
      console.error('Push recipient lookup failed; notification skipped:', error);
      return [];
    }
    for (const row of data || []) tokens.add(row.token);
    if (!data || data.length < 500) return [...tokens];
  }
}
