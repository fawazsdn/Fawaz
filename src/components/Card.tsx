import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { useTheme } from '@/theme/useTheme';

interface CardProps {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  style?: object;
  padded?: boolean;
  elevated?: boolean;
  accessibilityLabel?: string;
  /**
   * Set when `children` contains its own focusable buttons (e.g. a feed
   * card with like/save/share actions nested inside a whole-card
   * onPress). On web, react-native-web renders a Pressable with
   * `accessibilityRole="button"` as a real `<button>` element — nesting
   * another real `<button>` inside it is invalid HTML (React logs
   * "cannot contain a nested <button>" and, worse, the browser closes
   * the outer button early, breaking the inner ones). Passing true here
   * switches the card's own role to "link" (RN-Web renders that as an
   * `<a>`, not a `<button>`) — still announced as tappable to screen
   * readers, but without claiming the literal button role, so its real
   * button children stay valid and reachable. "link" fits semantically
   * too: tapping the card navigates to its detail view.
   */
  interactiveChildren?: boolean;
}

export function Card({
  children,
  onPress,
  style,
  padded = true,
  elevated = true,
  accessibilityLabel,
  interactiveChildren = false,
}: CardProps) {
  const theme = useTheme();
  const base = [
    styles.base,
    {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      padding: padded ? theme.spacing.md : 0,
    },
    elevated && theme.shadows.card,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole={interactiveChildren ? 'link' : 'button'}
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [...base, { opacity: pressed ? 0.92 : 1 }]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
