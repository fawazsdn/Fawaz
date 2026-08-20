import type { Poll } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface PollService {
  getPoll(id: string): Promise<Poll | undefined>;
  vote(pollId: string, optionId: string): Promise<void>;
  createPoll(input: { question: string; options: string[]; closesInHours: number }): Promise<Poll>;
}

export const pollService: PollService = {
  async getPoll(id) {
    return mockDelay(useStore.getState().polls.find((p) => p.id === id));
  },
  async vote(pollId, optionId) {
    useStore.getState().voteInPoll(pollId, optionId);
    return mockDelay(undefined, 200);
  },
  async createPoll(input) {
    return mockDelay(useStore.getState().createPoll(input), 350);
  },
};
