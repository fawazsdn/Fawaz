import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { fetchNeighborhoodChanges, reviewNeighborhoodChange } from '@/backend/actions';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { NeighborhoodChangeDetails } from '@/components/NeighborhoodChangeDetails';
import { useAction } from '@/hooks/useAction';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/useTheme';

export default function NeighborhoodChangeQueue() {
  const { t } = useI18n();
  const theme = useTheme();
  const copy = t.neighborhoodChange;
  const admin = useStore((s) => s.currentUser()?.role === 'admin');
  const caller = useStore((s) => s.session.supabaseUserId);
  const { data, error, loading, refetch } = useAsync(() => (admin ? fetchNeighborhoodChanges(true) : Promise.resolve([])), [admin, caller]);
  const { pending, run } = useAction();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const review = async (id: string, approve: boolean) => {
    const note = notes[id]?.trim();
    if (!note) return;
    await run(() => reviewNeighborhoodChange(id, approve, note));
    refetch();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={copy.adminTitle} fallbackRoute="/settings" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
        {!admin ? <Text style={theme.text('body')}>{t.clubs.admin.notAdmin}</Text> : null}
        {admin && loading ? <Text style={theme.text('body')}>{t.common.loading}</Text> : null}
        {admin && error ? <Button variant="outline" label={`${copy.loadError} ${copy.retry}`} onPress={refetch} /> : null}
        {admin && data?.length === 0 ? <Text style={theme.text('body')}>{copy.empty}</Text> : null}
        {admin &&
          data?.map((request) => (
            <Card key={request.id}>
              <NeighborhoodChangeDetails request={request} />
              <Text selectable style={theme.text('caption')}>
                {request.user_id}
              </Text>
              {request.user_id !== caller ? (
                <>
                  <TextInput
                    accessibilityLabel={copy.reviewNote}
                    placeholder={copy.reviewNote}
                    placeholderTextColor={theme.colors.textMuted}
                    style={theme.text('body')}
                    value={notes[request.id] ?? ''}
                    onChangeText={(value) => setNotes((previous) => ({ ...previous, [request.id]: value }))}
                    maxLength={1000}
                    multiline
                  />
                  <Button label={copy.approve} onPress={() => review(request.id, true)} disabled={pending || !notes[request.id]?.trim()} />
                  <Button
                    variant="outline"
                    label={copy.reject}
                    onPress={() => review(request.id, false)}
                    disabled={pending || !notes[request.id]?.trim()}
                  />
                </>
              ) : null}
            </Card>
          ))}
        {admin ? <Button variant="outline" label={copy.refresh} onPress={refetch} /> : null}
      </ScrollView>
    </View>
  );
}
