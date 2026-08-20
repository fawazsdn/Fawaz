import type { ReputationEvent, User } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface ProfileService {
  getUser(id: string): Promise<User | undefined>;
  updateProfile(input: {
    firstName: string;
    lastName: string;
    namePrivacy: User['namePrivacy'];
    bio?: string;
    avatarUrl?: string;
  }): Promise<void>;
  getReputationEvents(userId: string): Promise<ReputationEvent[]>;
  thankUser(userId: string, reasonAr: string, message?: string): Promise<void>;
}

export const profileService: ProfileService = {
  async getUser(id) {
    return mockDelay(useStore.getState().users.find((u) => u.id === id));
  },
  async updateProfile(input) {
    useStore.getState().createProfile(input);
    return mockDelay(undefined, 300);
  },
  async getReputationEvents(userId) {
    return mockDelay(
      useStore
        .getState()
        .reputationEvents.filter((r) => r.userId === userId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
      200,
    );
  },
  async thankUser(userId, reasonAr, message) {
    useStore.getState().thankUser(userId, reasonAr, message);
    return mockDelay(undefined, 250);
  },
};
