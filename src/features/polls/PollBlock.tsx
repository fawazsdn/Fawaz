import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import type { Poll } from '@/models';
import { formatTimeUntil, localizeDigits } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { useAction } from '@/hooks/useAction';
import { voteInPoll } from '@/backend/actions';

interface PollBlockProps {
  poll: Poll;
}

/** Percent of total, rounded; 0 when nobody has voted. Exported for tests. */
export function pollPercent(votes: number, total: number): number {
  return total === 0 ? 0 : Math.round((votes / total) * 100);
}

/**
 * Residents vote once and can move their vote to another option until the
 * poll closes. The server RPC (vote_in_poll) keeps exactly one row per voter,
 * so changing A → B never counts twice; counts shown here come from the
 * server aggregate (get_poll_results), not from the client.
 */
export function PollBlock({ poll }: PollBlockProps) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const { run, pending } = useAction();
  // Optimistic highlight of the tapped option while the RPC is in flight.
  const [optimistic, setOptimistic] = useState<string | null>(null);

  const closed = new Date(poll.closesAt).getTime() <= Date.now();
  const selectedId = optimistic ?? poll.myOptionId;
  const hasVoted = !!poll.myOptionId;
  const showResults = hasVoted || closed;
  const canChange = !closed && poll.allowChange;

  useEffect(() => {
    if (optimistic && poll.myOptionId === optimistic) setOptimistic(null);
  }, [poll.myOptionId, optimistic]);

  const onSelect = async (optionId: string) => {
    if (closed || pending || optionId === poll.myOptionId) return;
    if (hasVoted && !poll.allowChange) return;
    haptics.selection();
    setOptimistic(optionId);
    const res = await run(() => voteInPoll(poll.id, optionId));
    if (!res.ok) setOptimistic(null);
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={theme.text('title')}>{poll.question}</Text>
      <View style={{ gap: 8, marginTop: 4 }}>
        {poll.options.map((option) => (
          <PollOptionRow
            key={option.id}
            label={option.textAr}
            pct={pollPercent(option.votes, poll.totalVotes)}
            selected={selectedId === option.id}
            showResults={showResults}
            disabled={closed || pending || (hasVoted && !poll.allowChange)}
            onPress={() => onSelect(option.id)}
            yourVoteLabel={t.polls.yourVote}
            locale={locale}
          />
        ))}
      </View>
      <Text style={theme.text('caption', theme.colors.textMuted)}>
        {localizeDigits(poll.totalVotes, locale)} {t.polls.votes} ·{' '}
        {closed ? t.polls.closed : `${t.polls.closesIn} ${formatTimeUntil(poll.closesAt, locale)}`}
      </Text>
      {hasVoted && canChange ? <Text style={theme.text('caption', theme.colors.textMuted)}>{t.polls.changeHint}</Text> : null}
    </View>
  );
}

function PollOptionRow({
  label,
  pct,
  selected,
  showResults,
  disabled,
  onPress,
  yourVoteLabel,
  locale,
}: {
  label: string;
  pct: number;
  selected: boolean;
  showResults: boolean;
  disabled: boolean;
  onPress: () => void;
  yourVoteLabel: string;
  locale: 'ar' | 'en';
}) {
  const theme = useTheme();
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(showResults ? pct : 0, { duration: 450 });
  }, [showResults, pct, width]);

  const barStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.optionWrap,
        {
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.surface,
        },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={showResults ? `${label}, ${pct}%${selected ? `, ${yourVoteLabel}` : ''}` : label}
    >
      {showResults ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, barStyle, { backgroundColor: theme.colors.successSurface, borderRadius: theme.radii.sm }]}
        />
      ) : null}
      <View style={[theme.row(), styles.optionContent]}>
        <View style={[theme.row(), { alignItems: 'center', gap: 6, flex: 1 }]}>
          {selected ? <Check size={14} color={theme.colors.primary} /> : null}
          <Text style={[theme.text('bodySmall'), { flexShrink: 1 }]}>{label}</Text>
        </View>
        {showResults ? <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{localizeDigits(`${pct}%`, locale)}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  optionWrap: { borderWidth: 1.5, overflow: 'hidden' },
  optionContent: { justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, gap: 8 },
});
