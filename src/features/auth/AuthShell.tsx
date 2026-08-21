import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useSafeBack } from '@/hooks/useSafeBack';
import { IconButton } from '@/components/IconButton';

interface AuthShellProps {
  title: string;
  body?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showBack?: boolean;
  /** See AppHeader's `fallbackRoute` — same "no history" safety net. */
  fallbackRoute?: Href;
}

export function AuthShell({ title, body, children, footer, showBack = true, fallbackRoute = '/' }: AuthShellProps) {
  const theme = useTheme();
  const { isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const safeBack = useSafeBack(fallbackRoute);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        {showBack ? (
          <IconButton accessibilityLabel="back" onPress={safeBack} variant="surface">
            <BackIcon size={20} color={theme.colors.textPrimary} />
          </IconButton>
        ) : (
          <View style={{ height: 40 }} />
        )}
        <View style={{ marginTop: 20, marginBottom: 24 }}>
          <Text style={theme.text('heading1')}>{title}</Text>
          {body ? <Text style={[theme.text('body', theme.colors.textSecondary), { marginTop: 8 }]}>{body}</Text> : null}
        </View>
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: theme.colors.divider }]}>{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 24 },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
