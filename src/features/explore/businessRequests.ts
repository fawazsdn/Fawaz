import { supabase } from '@/lib/supabase';

export type BusinessRequestKind = 'suggestion' | 'correction' | 'claim';

export interface BusinessRequest {
  id: string;
  kind: BusinessRequestKind;
  details: string;
  neighborhood_id: string;
  business_id: string | null;
  requester_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export async function submitBusinessRequest(neighborhood: string, business: string | null, kind: BusinessRequestKind, details: string) {
  const { error } = await supabase.rpc('submit_business_directory_request', {
    p_neighborhood: neighborhood,
    p_business: business,
    p_kind: kind,
    p_details: details,
  });
  if (error) throw error;
}

export async function reviewBusinessRequest(id: string, approve: boolean) {
  const { error } = await supabase.rpc('review_business_directory_request', { p_request: id, p_approve: approve });
  if (error) throw error;
}

export async function getBusinessRequests(options: { requester?: string; pending?: boolean }) {
  let query = supabase.from('business_directory_requests').select('*').order('created_at', { ascending: false }).limit(100);
  if (options.requester) query = query.eq('requester_id', options.requester);
  if (options.pending) query = query.eq('status', 'pending');
  const { data, error } = await query;
  if (error) throw error;
  return data as BusinessRequest[];
}
