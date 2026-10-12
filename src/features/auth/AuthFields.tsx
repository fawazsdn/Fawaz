import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import type { AuthErrorReason } from './supabaseAuth';

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
}

/** Labelled text field used across the email auth screens. LTR input even in Arabic UI (emails/passwords are Latin). */
export const AuthTextField = forwardRef<TextInput, FieldProps>(function AuthTextField({ label, error, ...input }, ref) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginBottom: 6 }]}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={theme.colors.textMuted}
        accessibilityLabel={label}
        {...input}
        style={[
          theme.text('body'),
          styles.input,
          {
            borderColor: error ? theme.colors.danger : theme.colors.border,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.md,
            textAlign: 'left',
            writingDirection: 'ltr',
          },
        ]}
      />
      {error ? <Text style={[theme.text('caption', theme.colors.danger), { marginTop: 4 }]}>{error}</Text> : null}
    </View>
  );
});

export const PasswordField = forwardRef<TextInput, FieldProps>(function PasswordField({ label, error, ...input }, ref) {
  const theme = useTheme();
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginBottom: 6 }]}>{label}</Text>
      <View
        style={[
          styles.passwordWrap,
          {
            borderColor: error ? theme.colors.danger : theme.colors.border,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        <TextInput
          ref={ref}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={label}
          {...input}
          style={[theme.text('body'), styles.passwordInput, { textAlign: 'left', writingDirection: 'ltr' }]}
        />
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={visible ? t.auth.hidePassword : t.auth.showPassword}
          style={styles.eye}
        >
          {visible ? <EyeOff size={18} color={theme.colors.textMuted} /> : <Eye size={18} color={theme.colors.textMuted} />}
        </Pressable>
      </View>
      {error ? <Text style={[theme.text('caption', theme.colors.danger), { marginTop: 4 }]}>{error}</Text> : null}
    </View>
  );
});

export function useAuthErrorText() {
  const { t } = useI18n();
  return (reason: AuthErrorReason): string | null => {
    switch (reason) {
      case 'cancelled':
        return null;
      case 'invalid_credentials':
        return t.auth.errInvalidCredentials;
      case 'email_not_confirmed':
        return t.auth.errEmailNotConfirmed;
      case 'user_exists':
        return t.auth.errUserExists;
      case 'weak_password':
        return t.auth.errWeakPasswordServer;
      case 'invalid_email':
        return t.auth.errInvalidEmail;
      case 'rate_limited':
        return t.auth.errRateLimited;
      case 'network':
        return t.auth.errNetwork;
      case 'link_expired':
        return t.auth.errLinkExpired;
      default:
        return t.auth.signInError;
    }
  };
}

const styles = StyleSheet.create({
  input: { height: 50, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, height: 50 },
  passwordInput: { flex: 1, height: 50, paddingHorizontal: 14 },
  eye: { paddingHorizontal: 14, height: 50, justifyContent: 'center' },
});
