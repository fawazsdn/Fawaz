import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckSquare, Square } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';

interface Props {
  /** Sign-up shows a required checkbox; sign-in shows the notice only. */
  checked?: boolean;
  onToggle?: () => void;
  error?: boolean;
}

/**
 * Terms + Community Guidelines agreement (App Review Guideline 1.2 requires
 * users to agree to terms that make clear there is no tolerance for
 * objectionable content or abusive users), with links to the full text.
 */
export function ConsentNotice({ checked, onToggle, error }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const link = (label: string, key: 'terms' | 'guidelines' | 'privacy') => (
    <Text style={theme.text('caption', theme.colors.primary)} onPress={() => router.push(`/settings/info/${key}`)} accessibilityRole="link">
      {label}
    </Text>
  );

  return (
    <View style={{ gap: 8, marginVertical: 10 }}>
      {onToggle ? (
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!checked }}
          accessibilityLabel={t.consent.checkbox}
          style={[theme.row(), { gap: 8, alignItems: 'flex-start' }]}
          testID="consent-checkbox"
        >
          {checked ? (
            <CheckSquare size={20} color={theme.colors.primary} />
          ) : (
            <Square size={20} color={error ? theme.colors.danger : theme.colors.textMuted} />
          )}
          <Text style={[theme.text('caption', error ? theme.colors.danger : theme.colors.textSecondary), { flex: 1 }]}>
            {t.consent.checkbox}
          </Text>
        </Pressable>
      ) : null}
      <Text style={[theme.text('caption', theme.colors.textMuted), { textAlign: 'center' }]}>
        {t.consent.prefix} {link(t.consent.terms, 'terms')} {t.consent.and} {link(t.consent.guidelines, 'guidelines')}{' '}
        {t.consent.privacyPrefix} {link(t.consent.privacy, 'privacy')}.
      </Text>
      {error ? <Text style={[theme.text('caption', theme.colors.danger), { textAlign: 'center' }]}>{t.consent.required}</Text> : null}
    </View>
  );
}
