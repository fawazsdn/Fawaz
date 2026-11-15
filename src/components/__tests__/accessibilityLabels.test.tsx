import { Pressable, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ar from '@/i18n/ar';
import en from '@/i18n/en';
import { useStore } from '@/store/useStore';
import { resetStoreForTests } from '@/testing/fixtures';
import { Card } from '../Card';
import { Composer } from '../Composer';

const frame = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

beforeEach(() => resetStoreForTests());

describe('VoiceOver can reach controls', () => {
  it('a card with interactive children is not one accessibility element', async () => {
    const r = await render(
      <Card onPress={() => undefined} accessibilityLabel="post" interactiveChildren>
        <Pressable accessibilityRole="button" accessibilityLabel="Like"><Text>like</Text></Pressable>
      </Card>,
    );
    expect((r.toJSON() as { props: { accessible?: boolean } }).props.accessible).toBe(false);
  });

  it('a plain tappable card stays one element', async () => {
    const r = await render(<Card onPress={() => undefined} accessibilityLabel="item"><Text>item</Text></Card>);
    expect((r.toJSON() as { props: { accessible?: boolean } }).props.accessible).not.toBe(false);
  });

  it.each([['ar', ar.messages.send], ['en', en.messages.send]] as const)('the comment send button is labeled in %s', async (locale, label) => {
    useStore.getState().setLocale(locale);
    const r = await render(
      <SafeAreaProvider initialMetrics={frame}>
        <Composer placeholder="Write" onSend={async () => true} cancelLabel="Cancel" />
      </SafeAreaProvider>,
    );
    expect(r.getByTestId('composer-send').props.accessibilityLabel).toBe(label);
  });
});
