import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { resetStoreForTests } from '@/testing/fixtures';
import { Composer } from '../Composer';

const frame = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

beforeEach(() => resetStoreForTests());

it('ignores repeated taps while a comment is sending, then clears the draft on success', async () => {
  let resolve: (v: boolean) => void = () => undefined;
  const onSend = jest.fn(() => new Promise<boolean>((r) => (resolve = r)));
  const r = await render(
    <SafeAreaProvider initialMetrics={frame}>
      <Composer placeholder="Write" onSend={onSend} cancelLabel="Cancel" />
    </SafeAreaProvider>,
  );
  await act(async () => fireEvent.changeText(r.getByPlaceholderText('Write'), 'hello'));
  // Three taps in the same frame (no re-render in between).
  const send = r.getByTestId('composer-send');
  fireEvent.press(send);
  fireEvent.press(send);
  fireEvent.press(send);
  expect(onSend).toHaveBeenCalledTimes(1);
  await act(async () => resolve(true));
  await waitFor(() => expect(r.queryByDisplayValue('hello')).toBeNull());
});
