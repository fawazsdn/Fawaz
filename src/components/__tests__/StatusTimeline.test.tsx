import { render, screen } from '@testing-library/react-native';

import { StatusTimeline } from '@/components/StatusTimeline';

const steps = [
  { key: 'reported', label: 'تم الإبلاغ' },
  { key: 'confirmed', label: 'تم التأكيد' },
  { key: 'resolved', label: 'تم الحل' },
];

describe('StatusTimeline', () => {
  it('renders every step label', async () => {
    await render(<StatusTimeline steps={steps} activeIndex={1} />);
    steps.forEach((step) => expect(screen.getByText(step.label)).toBeTruthy());
  });
});
