import { supabase } from './supabase';
export const FALLBACK_SIGNUP_DOMAINS = [
  { institution: '博洛尼亚大学', domain: 'studio.unibo.it' },
  { institution: '博洛尼亚大学', domain: 'unibo.it' },
  { institution: '博洛尼亚大学', domain: 'esterni.unibo.it' },
];
export async function getAllowedSignupDomains() {
  const { data, error } = await supabase.from('allowed_signup_domains').select('domain, institution_name').eq('enabled', true).order('institution_name').order('domain');
  if (error || !data?.length) return FALLBACK_SIGNUP_DOMAINS;
  return data.map((row) => ({ institution: row.institution_name || '博洛尼亚大学', domain: row.domain }));
}
