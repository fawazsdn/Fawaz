import type { Business, Recommendation } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface BusinessService {
  getBusinesses(neighborhoodId: string): Promise<Business[]>;
  getBusiness(id: string): Promise<Business | undefined>;
  getRecommendations(businessId: string): Promise<Recommendation[]>;
  recommend(businessId: string, textAr: string): Promise<void>;
}

export const businessService: BusinessService = {
  async getBusinesses(neighborhoodId) {
    return mockDelay(
      useStore
        .getState()
        .businesses.filter((b) => b.neighborhoodIds.includes(neighborhoodId))
        .sort((a, b) => b.recommendationCount - a.recommendationCount),
    );
  },
  async getBusiness(id) {
    return mockDelay(useStore.getState().businesses.find((b) => b.id === id));
  },
  async getRecommendations(businessId) {
    return mockDelay(
      useStore
        .getState()
        .recommendations.filter((r) => r.businessId === businessId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
      250,
    );
  },
  async recommend(businessId, textAr) {
    useStore.getState().recommendBusiness(businessId, textAr);
    return mockDelay(undefined, 250);
  },
};
