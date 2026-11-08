import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { getBusinessRequests, reviewBusinessRequest, type BusinessRequest } from '@/features/explore/businessRequests';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/useTheme';

export default function AdminBusinessRequestsScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const local = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const { bottom } = useSafeAreaInsets();
  const admin = useStore((s) => s.currentUser()?.role === 'admin');
  const [rows, setRows] = useState<BusinessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setRows(await getBusinessRequests({ pending: true }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  const review = async (id: string, approve: boolean) => {
    setPending(true);
    try {
      await reviewBusinessRequest(id, approve);
      setRows((items) => items.filter((item) => item.id !== id));
    } catch {
      Alert.alert(t.errors.actionFailedTitle, t.errors.genericBody);
    } finally {
      setPending(false);
    }
  };

  const approveClaim = (row: BusinessRequest) => {
    Alert.alert(
      local('Confirm ownership', 'تأكيد الملكية'),
      local(
        'Approve only after verifying this resident is authorized to represent the business.',
        'وافق فقط بعد التحقق من أن مقدم الطلب مخول بتمثيل النشاط.',
      ),
      [
        { text: t.common.cancel, style: 'cancel' },
        { text: local('Approve', 'موافقة'), onPress: () => void review(row.id, true) },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={local('Business directory requests', 'طلبات دليل الأعمال')} fallbackRoute="/settings" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: 12, paddingBottom: bottom + 16 }}>
        {!admin ? <Text style={theme.text('body')}>{t.errors.forbidden}</Text> : null}
        {admin && error ? <Button label={t.common.retry} onPress={load} /> : null}
        {admin && !error && !loading && rows.length === 0 ? (
          <Text style={theme.text('body')}>{local('No requests awaiting review.', 'لا توجد طلبات قيد المراجعة.')}</Text>
        ) : null}
        {admin && !error
          ? rows.map((row) => (
              <Card key={row.id}>
                <Text style={theme.text('title')}>
                  {row.kind === 'claim'
                    ? local('Ownership claim', 'طلب ملكية')
                    : row.kind === 'correction'
                      ? local('Correction', 'تصحيح')
                      : local('Suggestion', 'اقتراح')}
                </Text>
                <Text style={theme.text('caption', theme.colors.textSecondary)}>
                  {row.neighborhood_id} · {row.business_id ?? row.requester_id}
                </Text>
                <Text style={[theme.text('body'), { marginVertical: 8 }]}>{row.details}</Text>
                <Text style={theme.text('bodySmall')}>
                  {row.kind === 'claim'
                    ? local('Confirm ownership independently before approval.', 'تحقق من الملكية بشكل مستقل قبل الموافقة.')
                    : local(
                        'Verify the source and update the listing before approving the request.',
                        'تحقق من المصدر وحدّث السجل قبل الموافقة على الطلب.',
                      )}
                </Text>
                <View style={{ gap: 8, marginTop: 8 }}>
                  <Button
                    label={local('Approve', 'موافقة')}
                    disabled={pending}
                    onPress={() => (row.kind === 'claim' ? approveClaim(row) : review(row.id, true))}
                  />
                  <Button label={local('Reject', 'رفض')} disabled={pending} variant="outline" onPress={() => review(row.id, false)} />
                </View>
              </Card>
            ))
          : null}
      </ScrollView>
    </View>
  );
}
