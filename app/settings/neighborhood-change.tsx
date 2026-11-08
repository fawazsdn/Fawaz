import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { fetchNeighborhoodChanges, requestNeighborhoodChange } from '@/backend/actions';
import { requestSync } from '@/backend/sync';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { NeighborhoodChangeDetails } from '@/components/NeighborhoodChangeDetails';
import { SearchBar } from '@/components/SearchBar';
import { useAction } from '@/hooks/useAction';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n/useI18n';
import { geographyService } from '@/services/geography';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/useTheme';
import type { GeographySearchResult } from '@/types/geography';

export default function NeighborhoodChangeScreen() {
  const { t, locale } = useI18n();
  const theme = useTheme();
  const copy = t.neighborhoodChange;
  const current = useStore((s) => s.session.neighborhoodId);
  const verified = useStore((s) => s.session.verification === 'verified');
  const caller = useStore((s) => s.session.supabaseUserId);
  const { data, error, loading, refetch } = useAsync(() => fetchNeighborhoodChanges(false), [caller]);
  const history = data?.filter((request) => request.user_id === caller);
  const approvedTarget = history?.find((request) => request.status === 'approved')?.to_neighborhood_id;
  useEffect(() => {
    if (verified && approvedTarget && approvedTarget !== current) void requestSync();
  }, [verified, approvedTarget, current]);
  const { pending, run } = useAction();
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');
  const [results, setResults] = useState<GeographySearchResult[]>([]);
  const [selected, setSelected] = useState<GeographySearchResult>();
  const name = locale === 'ar' ? 'nameAr' : 'nameEn';

  useEffect(() => {
    let active = true;
    geographyService.search(query, { limit: 40 }).then((hits) => {
      if (active) setResults(hits.filter((hit) => hit.neighborhood && hit.neighborhood.id !== current).slice(0, 10));
    });
    return () => {
      active = false;
    };
  }, [query, current]);

  const submit = async () => {
    if (!selected?.neighborhood) return;
    const id = selected.neighborhood.id;
    const result = await run(() => requestNeighborhoodChange(id, reason.trim()));
    if (result.ok) {
      setSelected(undefined);
      setQuery('');
      setReason('');
    }
    refetch();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={copy.title} fallbackRoute="/settings" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={theme.text('body')}>{copy.description}</Text>
        {verified && history && !loading && !error && !history.some((item) => item.status === 'pending') ? (
          <>
            <SearchBar
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setSelected(undefined);
                setResults([]);
              }}
              placeholder={copy.search}
            />
            {selected?.neighborhood ? (
              <Text style={theme.text('body')}>
                {selected.neighborhood[name]} · {selected.city[name]}
              </Text>
            ) : (
              results.map((hit) => (
                <Button
                  key={hit.neighborhood!.id}
                  variant="outline"
                  label={`${hit.neighborhood![name]} · ${hit.city[name]}`}
                  onPress={() => setSelected(hit)}
                />
              ))
            )}
            <TextInput
              accessibilityLabel={copy.reason}
              placeholder={copy.reason}
              placeholderTextColor={theme.colors.textMuted}
              style={theme.text('body')}
              value={reason}
              onChangeText={setReason}
              maxLength={1000}
              multiline
            />
            <Button label={copy.send} onPress={submit} loading={pending} disabled={!selected || reason.trim().length < 10} />
          </>
        ) : null}
        <Text style={theme.text('heading3')}>{copy.history}</Text>
        {loading ? <Text style={theme.text('body')}>{t.common.loading}</Text> : null}
        {error ? <Button variant="outline" label={`${copy.loadError} ${copy.retry}`} onPress={refetch} /> : null}
        {history?.length === 0 ? <Text style={theme.text('body')}>{copy.empty}</Text> : null}
        {history?.map((request) => (
          <Card key={request.id}>
            <NeighborhoodChangeDetails request={request} />
          </Card>
        ))}
        <Button variant="outline" label={copy.refresh} onPress={refetch} />
      </ScrollView>
    </View>
  );
}
