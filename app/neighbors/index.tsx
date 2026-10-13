import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EyeOff, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { cancelNeighborRequest, discoverNeighbors, respondNeighborRequest, sendNeighborRequest } from '@/backend/actions';
import { requestSync } from '@/backend/sync';
import type { DiscoveredNeighbor, User } from '@/models';
import { displayName, localizeDigits } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';
import { SearchBar } from '@/components/SearchBar';
import { VerifyGate, useNeedsVerification } from '@/components/VerifyGate';

type Tab = 'discover' | 'mine' | 'requests' | 'sent';

/**
 * Neighbors: opt-in discovery, my private neighbor list, incoming and sent
 * requests. Everything shown comes from real Supabase rows the resident is
 * allowed to read; nobody appears in Discover unless they opted in.
 */
export default function NeighborsScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const needsVerification = useNeedsVerification();
  const { run, pending } = useAction();
  const me = useStore((s) => s.session.supabaseUserId ?? '');
  const users = useStore((s) => s.users);
  const connections = useStore((s) => s.neighborConnections);
  const requests = useStore((s) => s.neighborRequests);
  const settings = useStore((s) => s.neighborSettings);

  const [tab, setTab] = useState<Tab>(
    params.tab === 'requests' || params.tab === 'mine' || params.tab === 'sent' ? params.tab : 'discover',
  );
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<DiscoveredNeighbor[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const incoming = useMemo(() => requests.filter((r) => r.recipientId === me && r.status === 'pending'), [requests, me]);
  const outgoing = useMemo(() => requests.filter((r) => r.requesterId === me && r.status === 'pending'), [requests, me]);
  const userOf = useCallback((id: string): User | undefined => users.find((u) => u.id === id), [users]);

  const search = useCallback(async (q: string) => {
    setFailed(false);
    try {
      setFound(await discoverNeighbors(q));
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (needsVerification || tab !== 'discover') return;
    const timer = setTimeout(() => search(query), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query, tab, search, needsVerification, requests, connections]);

  const onRefresh = async () => {
    setRefreshing(true);
    await requestSync();
    if (tab === 'discover') await search(query);
    setRefreshing(false);
  };

  if (needsVerification) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.neighbors.title} fallbackRoute="/" />
        <VerifyGate />
      </View>
    );
  }

  const openProfile = (id: string) => router.push(`/profile/${id}`);
  const count = (n: number) => (n > 0 ? ` · ${localizeDigits(n, locale)}` : '');

  const row = (
    key: string,
    name: string,
    avatar: string | undefined,
    subtitle: string | null,
    onPress: () => void,
    right?: React.ReactNode,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={[theme.row(), styles.row, { borderBottomColor: theme.colors.divider }]}
    >
      <Avatar uri={avatar} name={name} size={46} />
      <View style={{ flex: 1 }}>
        <Text style={theme.text('title')} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={theme.text('caption', theme.colors.textMuted)} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );

  const discoverRow = (n: DiscoveredNeighbor) => {
    const name = `${n.firstName} ${n.lastName ? (n.lastName.length === 1 ? `${n.lastName}.` : n.lastName) : ''}`.trim();
    const bits = [
      n.sharedInterests.length > 0
        ? `${t.neighbors.sharedInterests}: ${n.sharedInterests.map((i) => t.neighbors.interests[i]).join('، ')}`
        : null,
      n.mutualCount ? t.neighbors.mutual.replace('{n}', localizeDigits(n.mutualCount, locale)) : null,
    ].filter(Boolean);
    const right =
      n.state === 'none' ? (
        <Button label={t.neighbors.addNeighbor} size="sm" disabled={pending} onPress={() => run(() => sendNeighborRequest(n.userId))} />
      ) : n.state === 'request_sent' ? (
        <Text style={theme.text('caption', theme.colors.textMuted)}>{t.neighbors.requestSent}</Text>
      ) : n.state === 'connected' ? (
        <Text style={theme.text('caption', theme.colors.primary)}>{t.neighbors.connected}</Text>
      ) : n.state === 'request_received' ? (
        <Text style={theme.text('caption', theme.colors.info)}>{t.neighbors.wantsToConnect}</Text>
      ) : null;
    return row(n.userId, name, n.avatarUrl, bits.join(' · ') || n.bio || null, () => openProfile(n.userId), right);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.neighbors.title} fallbackRoute="/" />
      <View style={{ marginBottom: 8 }}>
        <FilterBar
          options={[
            { key: 'discover', label: t.neighbors.discover },
            { key: 'mine', label: `${t.neighbors.myNeighbors}${count(connections.length)}` },
            { key: 'requests', label: `${t.neighbors.requests}${count(incoming.length)}` },
            { key: 'sent', label: `${t.neighbors.sent}${count(outgoing.length)}` },
          ]}
          selected={tab}
          onSelect={(k) => setTab(k as Tab)}
        />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {tab === 'discover' ? (
          <>
            {settings && !settings.discoverable ? (
              <Card style={{ marginBottom: 12 }}>
                <View style={[theme.row(), { gap: 10, alignItems: 'flex-start' }]}>
                  <EyeOff size={18} color={theme.colors.textMuted} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={theme.text('title')}>{t.neighbors.hiddenTitle}</Text>
                    <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{t.neighbors.hiddenBody}</Text>
                    <View style={{ alignSelf: 'flex-start', marginTop: 6 }}>
                      <Button
                        label={t.neighbors.openPrivacy}
                        size="sm"
                        variant="outline"
                        onPress={() => router.push('/settings/neighbors')}
                      />
                    </View>
                  </View>
                </View>
              </Card>
            ) : null}
            <View style={{ marginBottom: 6 }}>
              <SearchBar value={query} onChangeText={setQuery} placeholder={t.neighbors.searchPlaceholder} />
            </View>
            {failed ? (
              <EmptyState title={t.errors.genericTitle} actionLabel={t.common.retry} onAction={() => search(query)} compact />
            ) : found === null ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.primary} />
            ) : found.length === 0 ? (
              <EmptyState icon={Users} title={t.neighbors.emptyDiscover} body={t.neighbors.emptyDiscoverBody} compact />
            ) : (
              found.map(discoverRow)
            )}
          </>
        ) : null}

        {tab === 'mine' ? (
          connections.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t.neighbors.emptyMine}
              body={t.neighbors.emptyMineBody}
              actionLabel={t.neighbors.discover}
              onAction={() => setTab('discover')}
            />
          ) : (
            connections.map((c) => {
              const u = userOf(c.userId);
              return row(c.userId, u ? displayName(u) : t.common.neighbor, u?.avatarUrl, null, () => openProfile(c.userId));
            })
          )
        ) : null}

        {tab === 'requests' ? (
          incoming.length === 0 ? (
            <EmptyState title={t.neighbors.emptyRequests} compact />
          ) : (
            incoming.map((r) => {
              const u = userOf(r.requesterId);
              return row(
                r.id,
                u ? displayName(u) : t.common.neighbor,
                u?.avatarUrl,
                t.neighbors.wantsToConnect,
                () => openProfile(r.requesterId),
                <View style={[theme.row(), { gap: 6 }]}>
                  <Button
                    label={t.neighbors.accept}
                    size="sm"
                    disabled={pending}
                    onPress={() => run(() => respondNeighborRequest(r.id, true))}
                  />
                  <Button
                    label={t.neighbors.decline}
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onPress={() => run(() => respondNeighborRequest(r.id, false))}
                  />
                </View>,
              );
            })
          )
        ) : null}

        {tab === 'sent' ? (
          outgoing.length === 0 ? (
            <EmptyState title={t.neighbors.emptySent} compact />
          ) : (
            outgoing.map((r) => {
              const u = userOf(r.recipientId);
              return row(
                r.id,
                u ? displayName(u) : t.common.neighbor,
                u?.avatarUrl,
                t.neighbors.requestSent,
                () => openProfile(r.recipientId),
                <Button
                  label={t.neighbors.cancelRequest}
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onPress={() => run(() => cancelNeighborRequest(r.recipientId))}
                />,
              );
            })
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
