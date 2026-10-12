import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { PollBlock, pollPercent } from '@/features/polls/PollBlock';
import { supabase } from '@/lib/supabase';
import type { Poll } from '@/models';
import { signInVerifiedForTests } from '@/testing/fixtures';

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 60000).toISOString();

function poll(extra: Partial<Poll> = {}): Poll {
  return {
    id: 'poll-1',
    postId: 'post-1',
    question: 'Test question?',
    neighborhoodId: 'sa-district-10500227013',
    closesAt: future,
    allowChange: true,
    options: [
      { id: 'opt-a', textAr: 'Option A', votes: 3 },
      { id: 'opt-b', textAr: 'Option B', votes: 1 },
    ],
    totalVotes: 4,
    ...extra,
  };
}

beforeEach(() => {
  signInVerifiedForTests();
  (supabase.rpc as jest.Mock).mockClear();
});

describe('pollPercent', () => {
  it('computes percentages from server counts', () => {
    expect(pollPercent(3, 4)).toBe(75);
    expect(pollPercent(0, 0)).toBe(0);
  });
});

describe('PollBlock', () => {
  it('hides results until the resident votes', async () => {
    await render(<PollBlock poll={poll()} />);
    expect(screen.queryByText('٧٥%')).toBeNull();
  });

  it('shows real percentages after voting and highlights my choice', async () => {
    await render(<PollBlock poll={poll({ myOptionId: 'opt-a' })} />);
    expect(screen.getByText('٧٥%')).toBeTruthy(); // Arabic UI: Arabic-Indic digits
    expect(screen.getByLabelText(/Option A, 75%/)).toBeTruthy();
  });

  it('lets the resident change their vote via the atomic server RPC', async () => {
    await render(<PollBlock poll={poll({ myOptionId: 'opt-a' })} />);
    await fireEvent.press(screen.getByLabelText(/Option B/));
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('vote_in_poll', { target_poll_id: 'poll-1', target_option_id: 'opt-b' }));
  });

  it('does not call the server when tapping the option already chosen', async () => {
    await render(<PollBlock poll={poll({ myOptionId: 'opt-a' })} />);
    await fireEvent.press(screen.getByLabelText(/Option A/));
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('blocks voting and changes once the poll is closed', async () => {
    await render(<PollBlock poll={poll({ closesAt: past, myOptionId: 'opt-a' })} />);
    await fireEvent.press(screen.getByLabelText(/Option B/));
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
