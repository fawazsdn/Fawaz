import type { MarketplaceListing } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface MarketplaceService {
  getListings(neighborhoodId: string): Promise<MarketplaceListing[]>;
  getListing(id: string): Promise<MarketplaceListing | undefined>;
  createListing(input: Omit<MarketplaceListing, 'id' | 'sellerId' | 'createdAt' | 'savedBy' | 'status'>): Promise<MarketplaceListing>;
  toggleSave(id: string): Promise<void>;
}

export const marketplaceService: MarketplaceService = {
  async getListings(neighborhoodId) {
    return mockDelay(
      useStore
        .getState()
        .marketplaceListings.filter((m) => m.neighborhoodId === neighborhoodId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    );
  },
  async getListing(id) {
    return mockDelay(useStore.getState().marketplaceListings.find((m) => m.id === id));
  },
  async createListing(input) {
    return mockDelay(useStore.getState().createListing(input), 350);
  },
  async toggleSave(id) {
    useStore.getState().toggleSaveListing(id);
    return mockDelay(undefined, 100);
  },
};
