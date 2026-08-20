import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import type { Poll } from '@/models';
import { formatRelativeTime } from '@/utils/format';
import { haptics } from '@/utils/haptics';

interface PollBlockProps {
  poll: Poll;
}

export function PollBlock({ poll }: PollBlockProps) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const voteInPoll = useStore((s) => s.voteInPoll);

  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
  const hasVoted = poll.options.some((o) => o.votes.includes(CURRENT_USER_ID));
  const closed = new Date(poll.closesAt).getTime() < Date.now();
  const showResults = hasVoted || closed;

  return (
    <View style={{ gap: 8 }}>
      <Text style={theme.text('title')}>{poll.question}</Text>
      <View style={{ gap: 8, marginTop: 4 }}>
        {poll.options.map((option) => (
          <PollOptionRow
            key={option.id}
            label={option.textAr}
            votes={option.votes.length}
            totalVotes={totalVotes}
            selected={option.votes.includes(CURRENT_USER_ID)}
            showResults={showResults}
            disabled={hasVoted || closed}
            onPress={() => {
              haptics.selection();
              voteInPoll(poll.id, option.id);
            }}
          />
        ))}
      </View>
      <Text style={theme.text('caption', theme.colors.textMuted)}>
        {totalVotes} {t.polls.votes} · {closed ? t.polls.closed : `${t.polls.closesIn} ${formatRelativeTime(poll.closesAt, locale).replace('قبل', '').trim()}`}
      </Text>
    </View>
  );
}

function PollOptionRow({
  label,
  votes,
  totalVotes,
  selected,
  showResults,
  disabled,
  onPress,
}: {
  label: string;
  votes: number;
  totalVotes: number;
  selected: boolean;
  showResults: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const pct = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);
  const width = useSharedValue(0);

  useEffect(() => {
    if (showResults) width.value = withTiming(pct, { duration: 500 });
  }, [showResults, pct, width]);

  const barStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.optionWrap,
        { borderColor: selected ? theme.colors.primary : theme.colors.border, borderRadius: theme.radii.sm, backgroundColor: theme.colors.surface },
      ]}
      accessibilityRole="button"
    >
      {showResults ? (
        <Animated.View style={[StyleSheet.absoluteFill, barStyle, { backgroundColor: theme.colors.successSurface, borderRadius: theme.radii.sm }]} />
      ) : null}
      <View style={[theme.row(), styles.optionContent]}>
        <Text style={theme.text('bodySmall')}>{label}</Text>
        {showResults ? <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{pct}%</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  optionWrap: { borderWidth: 1.5, overflow: 'hidden' },
  optionContent: { justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12 },
});
