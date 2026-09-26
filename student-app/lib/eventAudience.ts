export type EventAudience = 'all' | 'admins';

// This also hides cached internal activities immediately after logout or a role
// change. Supabase RLS is the authoritative check for every database request.
export function canViewEventAudience(audience: EventAudience | undefined, role?: string | null): boolean {
  return !audience || audience === 'all' || role === 'admin' || role === 'super_admin';
}
