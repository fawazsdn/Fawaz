import { fireEvent, render, screen } from '@testing-library/react-native';

import { PollBlock } from '@/features/polls/PollBlock';
import { useStore } from '@/store/useStore';

beforeEach(() => {
  useStore.getState().resetDemoData();
});

describe('PollBlock', () => {
  it('lets the user vote once and then shows results', async () => {
    const poll = useStore.getState().createPoll({ question: 'أفضل يوم؟', options: ['الخميس', 'الجمعة'], closesInHours: 48 });

    await render(<PollBlock poll={useStore.getState().polls.find((p) => p.id === poll.id)!} />);

    fireEvent.press(screen.getByText('الخميس'));

    const updated = useStore.getState().polls.find((p) => p.id === poll.id)!;
    const totalVotes = updated.options.reduce((sum, o) => sum + o.votes.length, 0);
    expect(totalVotes).toBe(1);
  });
});
