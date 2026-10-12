import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { CheckCircle2, Copy, MessageCircle, Share2, Users } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { REFERRAL_MILESTONES as milestones } from '@/features/invite/milestones';
import { recordShare as recordShareEvent } from '@/backend/actions';
import { localizeDigits } from '@/utils/format';
import { links } from '@/config/links';
import { buildInviteMessage } from '@/utils/inviteMessage';
import { openWhatsApp, shareContent } from '@/utils/share';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

/**
 * "Invites & Rewards". The referral code is issued server-side (referrals
 * table, created at sign-up); "joined" counts only server-attributed
 * sign-ups (referral_events 'signup_attributed'); "invites sent" counts
 * share taps on this device. Nothing is seeded.
 */
export default function InviteScreen() {
  const theme = useTheme();
  const { t, locale, isRTL } = useI18n();

  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === s.session.neighborhoodId));
  const referral = useStore((s) => s.referral);

  const code = referral.code ?? null;
  const joined = referral.joinedCount ?? 0;
  const [copied, setCopied] = useState(false);

  const neighborhoodName = neighborhood ? (locale === 'ar' ? neighborhood.nameAr : neighborhood.nameEn) : '';
  const inviteLink = neighborhood && code ? links.neighborhoodInvite(neighborhood.id, code) : null;

  const shareMessage = inviteLink
    ? buildInviteMessage({ neighborhoodName, link: inviteLink, locale })
    : buildInviteMessage({ neighborhoodName, link: links.neighborhoodInvite('', ''), locale });

  const recordShare = (channel: 'whatsapp' | 'native_share' | 'copy') => void recordShareEvent(channel).catch(() => {});

  const shareToWhatsApp = async () => {
    recordShare('whatsapp');
    const opened = await openWhatsApp(shareMessage);
    if (!opened) await shareContent({ title: t.invite.title, message: shareMessage });
  };

  const shareNative = () => {
    recordShare('native_share');
    shareContent({ title: t.invite.title, message: shareMessage, url: inviteLink ?? undefined });
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    recordShare('copy');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nextMilestone = milestones.find((m) => joined < m.threshold);

  const steps = [t.invite.step1, t.invite.step2, t.invite.step3, t.invite.step4];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.invite.title} fallbackRoute="/" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40, gap: 16 }}>
        <View
          style={{
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radii.xl,
            padding: theme.spacing.lg,
          }}
        >
          <Text style={theme.text('heading2', theme.colors.onPrimary)}>{t.invite.heroTitle}</Text>
          {neighborhoodName ? (
            <Text style={[theme.text('title', theme.colors.onPrimary), { marginTop: 4, opacity: 0.95 }]}>{neighborhoodName}</Text>
          ) : null}
          <Text style={[theme.text('bodySmall', theme.colors.onPrimary), { marginTop: 6, opacity: 0.9 }]}>{t.invite.heroBody}</Text>

          <View style={{ marginTop: 18, gap: 10 }}>
            <Button
              label={t.invite.shareWhatsApp}
              onPress={shareToWhatsApp}
              variant="secondary"
              icon={<MessageCircle size={18} color={theme.colors.onSecondary} />}
              fullWidth
            />
            <View style={[theme.row(), { gap: 10 }]}>
              <Pressable
                onPress={shareNative}
                accessibilityRole="button"
                accessibilityLabel={t.invite.shareOther}
                style={({ pressed }) => [
                  theme.row(),
                  styles.outlineBtn,
                  { borderColor: theme.colors.onPrimary + '55', opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Share2 size={17} color={theme.colors.onPrimary} />
                <Text style={theme.text('button', theme.colors.onPrimary)}>{t.invite.shareOther}</Text>
              </Pressable>
              <Pressable
                onPress={copyLink}
                accessibilityRole="button"
                accessibilityLabel={t.invite.copyLink}
                style={({ pressed }) => [
                  theme.row(),
                  styles.outlineBtn,
                  { borderColor: theme.colors.onPrimary + '55', opacity: pressed ? 0.8 : 1 },
                ]}
              >
                {copied ? <CheckCircle2 size={17} color={theme.colors.onPrimary} /> : <Copy size={17} color={theme.colors.onPrimary} />}
                <Text style={theme.text('button', theme.colors.onPrimary)}>{copied ? t.invite.linkCopied : t.invite.copyLink}</Text>
              </Pressable>
            </View>
          </View>

          {inviteLink ? (
            <Text style={[theme.text('caption', theme.colors.onPrimary), { marginTop: 14, opacity: 0.8 }]} numberOfLines={1} selectable>
              {inviteLink}
            </Text>
          ) : null}
        </View>

        <Card style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12 }}>
          <Stat value={referral.invitesSent} label={t.invite.invitesSent} />
          <Stat value={referral.joinedCount ?? '—'} label={t.invite.joined} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[theme.text('heading3', theme.colors.primary), { textAlign: 'center' }]} numberOfLines={1}>
              {nextMilestone ? (locale === 'ar' ? nextMilestone.titleAr : nextMilestone.titleEn) : '🏆'}
            </Text>
            <Text style={theme.text('caption', theme.colors.textMuted)} numberOfLines={1}>
              {nextMilestone ? t.invite.nextBadge : t.invite.allBadgesEarned}
            </Text>
          </View>
        </Card>
        <Text style={[theme.text('caption', theme.colors.textMuted), { textAlign: isRTL ? 'right' : 'left' }]}>
          {t.invite.joinedDisclaimer}
        </Text>

        {inviteLink ? (
          <Card style={{ alignItems: 'center', gap: 10 }}>
            <Text style={theme.text('title')}>{t.invite.qrTitle}</Text>
            {/* QR modules need real light/dark contrast to stay scannable —
                deliberately fixed colors, not theme tokens, independent of
                light/dark mode. */}
            <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: theme.radii.md }}>
              <QRCode value={inviteLink} size={140} color="#172D27" backgroundColor="#FFFFFF" />
            </View>
          </Card>
        ) : null}

        <View>
          <Text style={[theme.text('heading3'), { marginBottom: 10 }]}>{t.invite.howItWorksTitle}</Text>
          <Card style={{ gap: 0 }}>
            {steps.map((step, i) => (
              <View
                key={step}
                style={[
                  theme.row(),
                  {
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 12,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: theme.colors.divider,
                  },
                ]}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.backgroundAlt,
                  }}
                >
                  <Text style={theme.text('bodySmall', theme.colors.primary)}>{i + 1}</Text>
                </View>
                <Text style={[theme.text('bodySmall', theme.colors.textPrimary), { flex: 1 }]}>{step}</Text>
              </View>
            ))}
          </Card>
        </View>

        <View>
          <Text style={[theme.text('heading3'), { marginBottom: 10 }]}>{t.invite.milestonesTitle}</Text>
          <Card style={{ gap: 0 }}>
            {milestones.map((m, i) => {
              const reached = joined >= m.threshold;
              return (
                <View
                  key={m.key}
                  style={[
                    theme.row(),
                    {
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 12,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: theme.colors.divider,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: reached ? theme.colors.successSurface : theme.colors.backgroundAlt,
                    }}
                  >
                    {reached ? <CheckCircle2 size={19} color={theme.colors.success} /> : <Users size={17} color={theme.colors.textMuted} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={theme.text('title', reached ? theme.colors.textPrimary : theme.colors.textSecondary)}>
                      {locale === 'ar' ? m.titleAr : m.titleEn}
                    </Text>
                    <Text style={theme.text('caption', theme.colors.textMuted)}>
                      {reached
                        ? `${m.threshold} ${t.invite.joined.toLowerCase()}`
                        : `${localizeDigits(m.threshold - joined, locale)} ${t.invite.milestoneProgress}`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </View>

        {neighborhood ? (
          <Card>
            <Text style={theme.text('heading3')}>{t.invite.growthTitle}</Text>
            <View style={[theme.row(), { alignItems: 'baseline', gap: 6, marginTop: 8 }]}>
              <Text style={theme.text('heading1', theme.colors.primary)}>
                {neighborhood.residentsCount == null ? '—' : localizeDigits(neighborhood.residentsCount, locale)}
              </Text>
              <Text style={theme.text('bodySmall', theme.colors.textMuted)}>{t.invite.growthCurrentMembers}</Text>
            </View>
            <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginTop: 8 }]}>{t.invite.growthBody}</Text>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  const theme = useTheme();
  const { locale } = useI18n();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={theme.text('heading1', theme.colors.primary)}>{localizeDigits(value, locale)}</Text>
      <Text style={theme.text('caption', theme.colors.textMuted)} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = {
  outlineBtn: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.5,
  },
};
