import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { networkErrorKey } from '../lib/network';
import { appendPublications, fetchPublicationPage, type Publication, type PublicationFilter } from '../lib/publicationFeed';

export function usePublicationFeed(filter: PublicationFilter, identity: string | null = null) {
  const queryKey = JSON.stringify([filter.kind, filter.category, filter.search, identity]);
  const visibleKey = useRef(queryKey);
  const [items, setItems] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorReason, setErrorReason] = useState('requestErrorUnknown');
  const sequence = useRef(0);
  const offset = useRef(0);
  const more = useRef(false);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchPage(reset: boolean) {
    if (!reset && (busy.current || !more.current)) return false;
    if (reset && timer.current) { clearTimeout(timer.current); timer.current = null; }
    const request = reset ? ++sequence.current : sequence.current;
    busy.current = true;
    setHasError(false);
    if (reset) setRefreshing(true); else setLoadingMore(true);
    try {
      const page = await fetchPublicationPage(supabase, filter, reset ? 0 : offset.current);
      if (request !== sequence.current) return false;
      setItems(current => reset ? page.items : appendPublications(current, page.items));
      offset.current = page.nextOffset;
      more.current = page.hasMore;
      return true;
    } catch (error) {
      if (request === sequence.current) {
        setHasError(true); setErrorReason(networkErrorKey(error));
      }
      return false;
    } finally {
      if (request === sequence.current) {
        busy.current = false; setLoading(false); setRefreshing(false); setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    visibleKey.current = queryKey;
    sequence.current++;
    busy.current = true; more.current = false; offset.current = 0;
    setItems([]); setLoading(true); setRefreshing(false); setLoadingMore(false); setHasError(false);
    timer.current = setTimeout(() => { timer.current = null; void fetchPage(true); }, filter.search.trim() ? 250 : 0);
    return () => {
      sequence.current++;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [filter.kind, filter.category, filter.search, identity]);

  const matches = visibleKey.current === queryKey;
  return { items: matches ? items : [], loading: !matches || loading,
    refreshing, loadingMore, hasError: matches && hasError, errorReason,
    refresh: () => fetchPage(true), loadMore: () => fetchPage(false) };
}
