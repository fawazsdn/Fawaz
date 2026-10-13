import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { setMyInterests, updateNeighborSettings } from '@/backend/actions';
import { INTERESTS, mapNeighborSettings } from '@/backend/sync';
import type { Interest, NeighborSettings } from '@/models';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';

type Key = keyof NeighborSettings;

/** Neighbor privacy. Every toggle is saved on the server immediately; defaults are private. */
export default function NeighborPrivacyScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { run, pending } = useAction();
  const stored = useStore((s) => s.neighborSettings);
  const storedInterests = useStore((s) => s.myInterests);
  const settings = stored ?? mapNeighborSettings(null);
  const [interests, setInterests] = useState<Interest[]>(storedInterests);
  const [saved, setSaved] = useState(false);

  useEffect(() => setInterests(storedInterests), [storedInterests]);

  const toggle = (key: Key, value: boolean) => {
    void run(() => updateNeighborSettings({ [key]: value }));
  };
  const p = t.neighbors.privacy;

  const rows: { key: Key; label: string; hint?: string }[] = [
    { key: 'discoverable', label: p.discoverable, hint: p.discoverableHint },
    { key: 'allowRequests', label: p.allowRequests, hint: p.allowRequestsHint },
    { key: 'allowNeighborMessages', label: p.allowMessages, hint: p.allowMessagesHint },
    { key: 'showInterests', label: p.showInterests },
    { key: 'showNeighborCount', label: p.showNeighborCount, hint: p.showNeighborCountHint },
    { key: 'showSharedClubs', label: p.showSharedClubs, hint: p.showSharedClubsHint },
  ];

  const changed = interests.length !== storedInterests.length || interests.some((i) => !storedInterests.includes(i));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={p.title} fallbackRoute="/settings" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 48, gap: 12 }}>
        {rows.map((r) => (
          <View key={r.key} style={[styles.row, { borderBottomColor: theme.colors.divider }]}>
            <View style={[theme.row(), { alignItems: 'center', justifyContent: 'space-between', gap: 12 }]}>
              <Text style={[theme.text('body'), { flex: 1 }]}>{r.label}</Text>
              <Switch
                value={settings[r.key]}
                onValueChange={(v) => toggle(r.key, v)}
                disabled={pending}
                trackColor={{ true: theme.colors.primary }}
                accessibilityLabel={r.label}
              />
            </View>
            {r.hint ? <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 4 }]}>{r.hint}</Text> : null}
          </View>
        ))}

        <Card>
          <View style={[theme.row(), { gap: 8, alignItems: 'flex-start' }]}>
            <ShieldCheck size={16} color={theme.colors.primary} />
            <Text style={[theme.text('caption', theme.colors.textSecondary), { flex: 1 }]}>{p.neverShared}</Text>
          </View>
        </Card>

        <View style={{ marginTop: 8 }}>
          <Text style={[theme.text('title'), { marginBottom: 4 }]}>{p.interests}</Text>
          <Text style={[theme.text('caption', theme.colors.textMuted), { marginBottom: 10 }]}>{p.interestsHint}</Text>
          <View style={[theme.row(), { gap: 8, flexWrap: 'wrap' }]}>
            {INTERESTS.map((i) => (
              <Chip
                key={i}
                label={t.neighbors.interests[i]}
                selected={interests.includes(i)}
                onPress={() => {
                  setSaved(false);
                  setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
                }}
              />
            ))}
          </View>
          <View style={{ marginTop: 14 }}>
            <Button
              label={saved && !changed ? t.common.saved : t.common.save}
              disabled={!changed || pending}
              onPress={async () => {
                const res = await run(() => setMyInterests(interests));
                if (res.ok) setSaved(true);
              }}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
