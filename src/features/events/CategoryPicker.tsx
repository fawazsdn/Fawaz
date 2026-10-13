import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { Chip } from '@/components/Chip';
import type { EventCategory } from '@/models';
import { CATEGORY_ICON, CUSTOM_CATEGORY_MAX, EVENT_CATEGORY_GROUPS, POPULAR_EVENT_CATEGORIES, type EventCategoryGroup } from './categories';

interface Props {
  value: EventCategory;
  onChange: (c: EventCategory) => void;
  customValue: string;
  onCustomChange: (v: string) => void;
  /** Show the "required" error under the Other field. */
  customError?: boolean;
}

/**
 * Activity category chips: ~9 popular ones, then every category grouped under
 * "Show more". Choosing "Other ✨" reveals a text field right below; the typed
 * text is kept while switching around (so nothing is lost) but only submitted
 * when "Other" is the selected category.
 */
export function CategoryPicker({ value, onChange, customValue, onCustomChange, customError }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  // Expanded from the start when editing an activity whose category is not a popular one.
  const [expanded, setExpanded] = useState(() => !POPULAR_EVENT_CATEGORIES.includes(value));
  const labels = t.eventCreate.categories as Record<EventCategory, string>;
  const groupLabels = t.eventCreate.categoryGroups as Record<EventCategoryGroup, string>;

  const chip = (c: EventCategory) => (
    <Chip key={c} label={`${CATEGORY_ICON[c]} ${labels[c]}`} selected={value === c} onPress={() => onChange(c)} />
  );

  return (
    <View>
      {expanded ? (
        <View style={{ gap: 14 }}>
          {(Object.keys(EVENT_CATEGORY_GROUPS) as EventCategoryGroup[]).map((g) => (
            <View key={g}>
              <Text style={[theme.text('caption', theme.colors.textMuted), { marginBottom: 6 }]}>{groupLabels[g]}</Text>
              <View style={[theme.row(), styles.wrap]}>{(EVENT_CATEGORY_GROUPS[g] as readonly EventCategory[]).map(chip)}</View>
            </View>
          ))}
        </View>
      ) : (
        <View style={[theme.row(), styles.wrap]}>{POPULAR_EVENT_CATEGORIES.map(chip)}</View>
      )}

      <Pressable
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        hitSlop={8}
        style={[theme.row(), { alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'flex-start' }]}
      >
        <Text style={theme.text('bodySmall', theme.colors.primary)}>
          {expanded ? t.eventCreate.showLessCategories : t.eventCreate.showMoreCategories}
        </Text>
        {expanded ? <ChevronUp size={16} color={theme.colors.primary} /> : <ChevronDown size={16} color={theme.colors.primary} />}
      </Pressable>

      {value === 'other' ? (
        <View style={{ marginTop: 12 }}>
          <Text style={[theme.text('caption', theme.colors.textSecondary), { marginBottom: 6 }]}>{t.eventCreate.customCategoryLabel}</Text>
          <TextInput
            testID="custom-category-input"
            value={customValue}
            onChangeText={(v) => onCustomChange(v.slice(0, CUSTOM_CATEGORY_MAX))}
            maxLength={CUSTOM_CATEGORY_MAX}
            placeholder={t.eventCreate.customCategoryPlaceholder}
            placeholderTextColor={theme.colors.textMuted}
            returnKeyType="done"
            style={[
              theme.text('body'),
              styles.input,
              { borderColor: customError ? theme.colors.danger : theme.colors.border, backgroundColor: theme.colors.surface },
            ]}
          />
          <View style={[theme.row(), { justifyContent: 'space-between', marginTop: 4 }]}>
            <Text style={theme.text('caption', theme.colors.danger)}>{customError ? t.eventCreate.customCategoryRequired : ''}</Text>
            <Text style={theme.text('caption', theme.colors.textMuted)}>
              {customValue.length}/{CUSTOM_CATEGORY_MAX}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, flexWrap: 'wrap' },
  input: { height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 14 },
});
