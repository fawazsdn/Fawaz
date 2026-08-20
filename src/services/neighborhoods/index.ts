import type { City, Neighborhood } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface NeighborhoodService {
  getCities(): Promise<City[]>;
  getNeighborhoods(citySlug: string): Promise<Neighborhood[]>;
  getNeighborhood(id: string): Promise<Neighborhood | undefined>;
  searchNeighborhoods(citySlug: string, query: string): Promise<Neighborhood[]>;
}

export const neighborhoodService: NeighborhoodService = {
  async getCities() {
    return mockDelay(useStore.getState().cities);
  },
  async getNeighborhoods(citySlug) {
    return mockDelay(useStore.getState().neighborhoods.filter((n) => n.citySlug === citySlug));
  },
  async getNeighborhood(id) {
    return mockDelay(useStore.getState().neighborhoods.find((n) => n.id === id));
  },
  async searchNeighborhoods(citySlug, query) {
    const q = query.trim().toLowerCase();
    const list = useStore.getState().neighborhoods.filter((n) => n.citySlug === citySlug);
    if (!q) return mockDelay(list, 150);
    return mockDelay(
      list.filter((n) => n.nameAr.includes(q) || n.nameEn.toLowerCase().includes(q)),
      150,
    );
  },
};
