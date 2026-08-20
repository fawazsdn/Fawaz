import type { BorrowItem } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface BorrowService {
  getItems(neighborhoodId: string): Promise<BorrowItem[]>;
  getItem(id: string): Promise<BorrowItem | undefined>;
  requestBorrow(id: string): Promise<void>;
}

export const borrowService: BorrowService = {
  async getItems(neighborhoodId) {
    return mockDelay(useStore.getState().borrowItems.filter((b) => b.neighborhoodId === neighborhoodId));
  },
  async getItem(id) {
    return mockDelay(useStore.getState().borrowItems.find((b) => b.id === id));
  },
  async requestBorrow(id) {
    useStore.getState().requestBorrow(id);
    return mockDelay(undefined, 250);
  },
};
