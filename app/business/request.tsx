import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { getBusinessRequests, submitBusinessRequest, type BusinessRequest } from '@/features/explore/businessRequests';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/useTheme';

export default function BusinessRequestScreen() {
  const { kind, business } = useLocalSearchParams<{ kind?: string; business?: string }>();
  const type = kind === 'correction' || kind === 'claim' ? kind : 'suggestion';
  const { t, locale } = useI18n();
  const local = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const neighborhood = useStore((s) => s.session.neighborhoodId);
  const userId = useStore((s) => s.session.supabaseUserId);
  const verified = useStore((s) => s.session.verification === 'verified');
  const [details, setDetails] = useState('');
  const [items, setItems] = useState<BusinessRequest[]>([]);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const title =
    type === 'suggestion'
      ? local('Suggest a business', 'اقتراح نشاط تجاري')
      : type === 'correction'
        ? local('Report incorrect information', 'الإبلاغ عن معلومات غير صحيحة')
        : local('Claim this business', 'طلب ملكية النشاط التجاري');

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getBusinessRequests({ requester: userId })
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch(() => {
        if (active) setMessage(t.errors.genericBody);
      });
    return () => {
      active = false;
    };
  }, [userId, t.errors.genericBody]);

  const send = async () => {
    const description = details.trim();
    if (submitting.current || !userId || !neighborhood || !verified || description.length < 10 || (type !== 'suggestion' && !business))
      return;
    submitting.current = true;
    setPending(true);
    setMessage('');
    try {
      await submitBusinessRequest(neighborhood, type === 'suggestion' ? null : (business ?? null), type, description);
      setDetails('');
      setMessage(local('Sent for staff review.', 'تم الإرسال للمراجعة.'));
      const requests = await getBusinessRequests({ requester: userId }).catch(() => null);
      if (requests) setItems(requests);
    } catch {
      setMessage(t.errors.genericBody);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <AppHeader title={title} fallbackRoute="/recommendations" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: bottom + 16, gap: 12 }}
      >
        {verified ? (
          <>
            <Text style={theme.text('bodySmall')}>
              {type === 'claim'
                ? local(
                    'Provide a public business contact or website staff can use to confirm your role. Keep passwords and private documents out of this form.',
                    'أضف وسيلة تواصل تجارية عامة أو موقعًا يمكن للفريق استخدامه لتأكيد صفتك. لا تضع كلمات مرور أو وثائق خاصة هنا.',
                  )
                : local(
                    'Include the business name, its neighborhood address or nearest landmark, and an official website or public business contact if available.',
                    'اذكر اسم النشاط وعنوانه في الحي أو أقرب معلم، وأضف موقعه الرسمي أو وسيلة تواصل تجارية عامة إن أمكن.',
                  )}
            </Text>
            <TextInput
              accessibilityLabel={local('Details', 'التفاصيل')}
              placeholder={local('Details', 'التفاصيل')}
              placeholderTextColor={theme.colors.textMuted}
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={2000}
              style={[
                theme.text('body'),
                {
                  minHeight: 100,
                  padding: 12,
                  borderRadius: theme.radii.md,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  textAlignVertical: 'top',
                },
              ]}
            />
            <Button
              label={local('Send for review', 'إرسال للمراجعة')}
              onPress={send}
              loading={pending}
              disabled={pending || details.trim().length < 10 || (type !== 'suggestion' && !business)}
              fullWidth
            />
          </>
        ) : (
          <Text style={theme.text('body')}>{t.errors.notVerified}</Text>
        )}
        {message ? (
          <Text accessibilityLiveRegion="polite" style={theme.text('bodySmall')}>
            {message}
          </Text>
        ) : null}
        {items.length ? <Text style={theme.text('title')}>{local('Your requests', 'طلباتك')}</Text> : null}
        {items.map((row) => (
          <View key={row.id} style={{ padding: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }}>
            <Text style={theme.text('bodySmall')}>
              {row.status === 'approved'
                ? local('Approved', 'مقبول')
                : row.status === 'rejected'
                  ? local('Rejected', 'مرفوض')
                  : local('Pending review', 'قيد المراجعة')}
            </Text>
            <Text style={theme.text('body')}>{row.details}</Text>
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
