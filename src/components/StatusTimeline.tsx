import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';

interface TimelineStep {
  key: string;
  label: string;
  note?: string;
  dateLabel?: string;
}

interface StatusTimelineProps {
  steps: TimelineStep[];
  activeIndex: number;
}

export function StatusTimeline({ steps, activeIndex }: StatusTimelineProps) {
  const theme = useTheme();

  return (
    <View>
      {steps.map((step, i) => {
        const done = i <= activeIndex;
        const isLast = i === steps.length - 1;
        return (
          <View key={step.key} style={[theme.row(), styles.row]}>
            <View style={styles.trackCol}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: done ? theme.colors.primary : theme.colors.surface,
                    borderColor: done ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                {done ? <Check size={11} color={theme.colors.onPrimary} /> : null}
              </View>
              {!isLast ? (
                <View style={[styles.line, { backgroundColor: i < activeIndex ? theme.colors.primary : theme.colors.border }]} />
              ) : null}
            </View>
            <View style={{ flex: 1, paddingBottom: isLast ? 0 : 18 }}>
              <Text style={theme.text('body', done ? theme.colors.textPrimary : theme.colors.textMuted)}>{step.label}</Text>
              {step.note ? <Text style={theme.text('caption', theme.colors.textSecondary)}>{step.note}</Text> : null}
              {step.dateLabel ? <Text style={theme.text('caption', theme.colors.textMuted)}>{step.dateLabel}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12 },
  trackCol: { alignItems: 'center', width: 22 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, marginTop: 2 },
});
