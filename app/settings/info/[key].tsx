import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { AppHeader } from '@/components/AppHeader';

const CONTENT_AR: Record<string, { title: string; body: string }> = {
  about: {
    title: 'عن حارتنا',
    body: 'حارتنا تطبيق مجتمعي سعودي يربط سكان الحي الواحد ببعض. هذا إصدار تجريبي للواجهة الأمامية فقط، وجميع البيانات هنا وهمية لأغراض العرض.',
  },
  help: {
    title: 'المساعدة',
    body: 'لأي استفسار حول استخدام التطبيق، يمكنك التواصل مع فريق الدعم عبر البريد الإلكتروني. هذا محتوى تجريبي.',
  },
  terms: {
    title: 'الشروط والأحكام',
    body: 'هذا نص تجريبي للشروط والأحكام. في النسخة الفعلية سيتم عرض الشروط الكاملة لاستخدام التطبيق.',
  },
  privacy: {
    title: 'سياسة الخصوصية',
    body: 'نحترم خصوصيتك. عنوان منزلك لا يُعرض أبدًا للعامة، ونعرض فقط الموقع التقريبي داخل الحي. هذا نص تجريبي.',
  },
};

const CONTENT_EN: Record<string, { title: string; body: string }> = {
  about: {
    title: 'About Haratna',
    body: 'Haratna is a Saudi neighborhood community app. This is a frontend-only demo build — all data here is mock content for demonstration purposes.',
  },
  help: {
    title: 'Help',
    body: 'For any question about using the app, reach out to our support team by email. This is demo content.',
  },
  terms: {
    title: 'Terms & Conditions',
    body: 'This is placeholder terms & conditions text. The production version will show the full terms of use.',
  },
  privacy: {
    title: 'Privacy Policy',
    body: 'We respect your privacy. Your home address is never shown publicly — only an approximate location within your neighborhood. This is placeholder text.',
  },
};

export default function InfoScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const theme = useTheme();
  const { locale } = useI18n();
  const content = (locale === 'ar' ? CONTENT_AR : CONTENT_EN)[key ?? 'about'] ?? CONTENT_AR.about!;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={content.title} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }}>
        <Text style={theme.text('body', theme.colors.textSecondary)}>{content.body}</Text>
      </ScrollView>
    </View>
  );
}
