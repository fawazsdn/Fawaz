import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/components/Button';

describe('Button', () => {
  it('renders its label', async () => {
    await render(<Button label="نشر" onPress={() => {}} />);
    expect(screen.getByText('نشر')).toBeTruthy();
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    await render(<Button label="متابعة" onPress={onPress} />);
    fireEvent.press(screen.getByText('متابعة'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="متابعة" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('متابعة'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
