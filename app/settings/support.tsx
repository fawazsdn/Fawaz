import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useAction } from '@/hooks/useAction';
import { fetchSupportRequests, submitSupportRequest, type SupportCategory, type SupportRequest } from '@/backend/actions';
import { SUPPORT_EMAIL } from '@/content/legal';
import { formatRelativeTime } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';

const CATEGORIES: SupportCategory[] = ['account', 'bug', 'safety', 'privacy', 'deletion', 'other'];

/** In-app support: a real request stored in support_requests and answered by Haratna staff. */
export default function SupportScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const { run, pending } = useAction();
  const [category, setCategory] = useState<SupportCategory>('bug');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<SupportRequest[]>([]);

  const load = useCallback(async () => {
    try {
      setMine(await fetchSupportRequests());
    } catch {
      setMine([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const valid = message.trim().length >= 10;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={t.support.title} fallbackRoute="/settings" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 48, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={theme.text('body', theme.colors.textSecondary)}>{t.support.intro}</Text>
        <View>
          <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginBottom: 8 }]}>{t.support.category}</Text>
          <View style={[theme.row(), { gap: 8, flexWrap: 'wrap' }]}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={t.support.categories[c]} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
        </View>
        <View>
          <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginBottom: 8 }]}>{t.support.message}</Text>
          <TextInput
            value={message}
            onChangeText={(v) => {
              setSent(false);
              setMessage(v);
            }}
            multiline
            maxLength={3000}
            accessibilityLabel={t.support.message}
            style={[theme.text('body'), styles.input, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
          />
          <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 4 }]}>{t.support.messageHint}</Text>
        </View>
        <Button
          label={t.support.send}
          disabled={!valid || pending}
          loading={pending}
          onPress={async () => {
            const res = await run(() => submitSupportRequest(category, message));
            if (res.ok) {
              setMessage('');
              setSent(true);
              load();
            }
          }}
          fullWidth
        />
        {sent ? <Text style={theme.text('bodySmall', theme.colors.primary)}>{t.support.sent}</Text> : null}
        {SUPPORT_EMAIL ? (
          <Text style={theme.text('caption', theme.colors.textMuted)}>
            {t.support.emailUs} {SUPPORT_EMAIL}
          </Text>
        ) : null}

        <Text style={[theme.text('title'), { marginTop: 10 }]}>{t.support.myRequests}</Text>
        {mine.length === 0 ? (
          <Text style={theme.text('bodySmall', theme.colors.textMuted)}>{t.support.noRequests}</Text>
        ) : (
          mine.map((r) => (
            <Card key={r.id}>
              <View style={[theme.row(), { gap: 6, alignItems: 'center', marginBottom: 6 }]}>
                <Badge label={t.support.categories[r.category]} tone="neutral" />
                <Badge label={t.support.status[r.status]} tone={r.status === 'open' ? 'warning' : 'success'} />
                <Text style={theme.text('caption', theme.colors.textMuted)}>{formatRelativeTime(r.createdAt, locale)}</Text>
              </View>
              <Text style={theme.text('bodySmall')}>{r.message}</Text>
              {r.response ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={theme.text('caption', theme.colors.textMuted)}>{t.support.reply}</Text>
                  <Text style={theme.text('bodySmall', theme.colors.primary)}>{r.response}</Text>
                </View>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 120, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, textAlignVertical: 'top' },
});
