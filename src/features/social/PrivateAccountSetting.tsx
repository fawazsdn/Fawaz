import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, UserPlus } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useAction } from '@/hooks/useAction';
import { useCurrentUserId } from '@/store/useStore';
import { fetchSocialProfile, setAccountPrivate } from '@/backend/social';
import { useSocialAvailable } from '@/backend/socialState';

/** Private account switch + follow requests entry. Hidden until the social backend is deployed. */
export function PrivateAccountSetting() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const me = useCurrentUserId();
  const socialOn = useSocialAvailable();
  const { run, pending } = useAction();
  const [isPrivate, setIsPrivate] = useState<boolean | null>(null);

  useEffect(() => {
    if (!socialOn || !me) return;
    fetchSocialProfile(me)
      .then((p) => setIsPrivate(p?.isPrivate ?? false))
      .catch(() => setIsPrivate(null));
  }, [socialOn, me]);

  if (!socialOn) return null;

  const toggle = async (v: boolean) => {
    const prev = isPrivate;
    setIsPrivate(v);
    const res = await run(() => setAccountPrivate(v));
    if (!res.ok) setIsPrivate(prev);
  };

  return (
    <View>
      <View style={[theme.row(), { alignItems: 'center', gap: 12, paddingVertical: 12 }]}>
        <Lock size={18} color={theme.colors.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={theme.text('body')}>{t.social.privateAccount}</Text>
          <Text style={theme.text('caption', theme.colors.textMuted)}>{t.social.privateAccountHint}</Text>
        </View>
        <Switch
          value={!!isPrivate}
          disabled={isPrivate === null || pending}
          onValueChange={toggle}
          trackColor={{ true: theme.colors.primary }}
          accessibilityLabel={t.social.privateAccount}
          testID="private-account-switch"
        />
      </View>
      <Pressable
        onPress={() => router.push('/follow-requests')}
        style={[theme.row(), { alignItems: 'center', gap: 12, paddingVertical: 12 }]}
        accessibilityRole="button"
      >
        <UserPlus size={18} color={theme.colors.textSecondary} />
        <Text style={[theme.text('body'), { flex: 1 }]}>{t.social.followRequests}</Text>
      </Pressable>
    </View>
  );
}
