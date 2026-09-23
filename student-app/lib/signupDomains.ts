import { supabase } from './supabase';

export type SignupDomain = {
  institution: string;
  domain: string;
};

export async function getAllowedSignupDomains(): Promise<SignupDomain[]> {
  const { data, error } = await supabase
    .from('allowed_signup_domains')
    .select('domain, institution_name')
    .eq('enabled', true)
    .order('institution_name')
    .order('domain');

  if (error) throw error;

  // An empty list is a valid server configuration, not a reason to restore old domains.
  return (data ?? []).map((row) => ({
    institution: row.institution_name || '博洛尼亚大学',
    domain: row.domain.toLowerCase(),
  }));
}
