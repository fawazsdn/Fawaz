import type { LostFoundPost } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface LostFoundService {
  getPosts(neighborhoodId: string): Promise<LostFoundPost[]>;
  getPost(id: string): Promise<LostFoundPost | undefined>;
  create(
    input: Omit<LostFoundPost, 'id' | 'authorId' | 'createdAt' | 'status'> & { status?: LostFoundPost['status'] },
  ): Promise<LostFoundPost>;
  setStatus(id: string, status: LostFoundPost['status']): Promise<void>;
}

export const lostFoundService: LostFoundService = {
  async getPosts(neighborhoodId) {
    return mockDelay(
      useStore
        .getState()
        .lostFound.filter((l) => l.neighborhoodId === neighborhoodId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    );
  },
  async getPost(id) {
    return mockDelay(useStore.getState().lostFound.find((l) => l.id === id));
  },
  async create(input) {
    return mockDelay(useStore.getState().createLostFound(input), 350);
  },
  async setStatus(id, status) {
    useStore.getState().markLostFoundStatus(id, status);
    return mockDelay(undefined, 150);
  },
};
