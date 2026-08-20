import type { Poll } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface PollService {
  getPoll(id: string): Promise<Poll | undefined>;
  vote(pollId: string, optionId: string): Promise<void>;
}

export const pollService: PollService = {
  async getPoll(id) {
    return mockDelay(useStore.getState().polls.find((p) => p.id === id));
  },
  async vote(pollId, optionId) {
    useStore.getState().voteInPoll(pollId, optionId);
    return mockDelay(undefined, 200);
  },
};
