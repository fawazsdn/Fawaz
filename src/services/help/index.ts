import type { HelpRequest } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface HelpRequestService {
  getHelpRequests(neighborhoodId: string): Promise<HelpRequest[]>;
  getHelpRequest(id: string): Promise<HelpRequest | undefined>;
  createHelpRequest(input: Omit<HelpRequest, 'id' | 'requesterId' | 'createdAt' | 'offeredBy' | 'status'>): Promise<HelpRequest>;
  offerHelp(id: string): Promise<void>;
  resolve(id: string): Promise<void>;
}

export const helpRequestService: HelpRequestService = {
  async getHelpRequests(neighborhoodId) {
    return mockDelay(
      useStore
        .getState()
        .helpRequests.filter((h) => h.neighborhoodId === neighborhoodId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    );
  },
  async getHelpRequest(id) {
    return mockDelay(useStore.getState().helpRequests.find((h) => h.id === id));
  },
  async createHelpRequest(input) {
    return mockDelay(useStore.getState().createHelpRequest(input), 350);
  },
  async offerHelp(id) {
    useStore.getState().offerHelp(id);
    return mockDelay(undefined, 250);
  },
  async resolve(id) {
    useStore.getState().resolveHelpRequest(id);
    return mockDelay(undefined, 150);
  },
};
