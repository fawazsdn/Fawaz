import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { fetchSupportRequests, respondSupportRequest, type SupportRequest } from '@/backend/actions';
import { formatRelativeTime } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';

/** Staff inbox for support requests. The RPCs refuse non-staff; this screen only hides itself. */
export default function AdminSupportScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const { run, pending } = useAction();
  const isStaff = useStore((s) => {
    const role = s.currentUser()?.role;
    return role === 'admin' || role === 'moderator';
  });
  const [rows, setRows] = useState<SupportRequest[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setRows(await fetchSupportRequests());
    } catch {
      setRows([]);
    }
  }, []);
  useEffect(() => {
    if (isStaff) load();
  }, [isStaff, load]);

  if (!isStaff) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.support.adminTitle} fallbackRoute="/settings" />
        <EmptyState title={t.clubs.admin.notAdmin} />
      </View>
    );
  }

  const reply = async (r: SupportRequest, close: boolean) => {
    const text = (drafts[r.id] ?? '').trim();
    if (!text) return;
    const res = await run(() => respondSupportRequest(r.id, text, close));
    if (res.ok) {
      setDrafts((d) => ({ ...d, [r.id]: '' }));
      load();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.support.adminTitle} fallbackRoute="/settings" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {rows.length === 0 ? <EmptyState title={t.support.noRequests} compact /> : null}
        {rows.map((r) => (
          <Card key={r.id}>
            <View style={[theme.row(), { gap: 6, alignItems: 'center', marginBottom: 6 }]}>
              <Badge label={t.support.categories[r.category]} tone={r.category === 'safety' ? 'danger' : 'neutral'} />
              <Badge label={t.support.status[r.status]} tone={r.status === 'open' ? 'warning' : 'success'} />
              <Text style={theme.text('caption', theme.colors.textMuted)}>{formatRelativeTime(r.createdAt, locale)}</Text>
            </View>
            <Text style={theme.text('bodySmall')}>{r.message}</Text>
            {r.response ? <Text style={[theme.text('caption', theme.colors.primary), { marginTop: 6 }]}>{r.response}</Text> : null}
            {r.status !== 'closed' ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                <TextInput
                  value={drafts[r.id] ?? ''}
                  onChangeText={(v) => setDrafts((d) => ({ ...d, [r.id]: v }))}
                  placeholder={t.support.responsePlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  style={[theme.text('body'), styles.input, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
                />
                <View style={[theme.row(), { gap: 8 }]}>
                  <Button label={t.support.respond} size="sm" disabled={pending} onPress={() => reply(r, false)} />
                  <Button label={t.support.respondAndClose} size="sm" variant="outline" disabled={pending} onPress={() => reply(r, true)} />
                </View>
              </View>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 70, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, textAlignVertical: 'top' },
});
