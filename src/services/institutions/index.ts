import type { Institution } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface InstitutionService {
  getInstitutions(neighborhoodId: string): Promise<Institution[]>;
  getInstitution(id: string): Promise<Institution | undefined>;
}

export const institutionService: InstitutionService = {
  async getInstitutions(neighborhoodId) {
    return mockDelay(useStore.getState().institutions.filter((i) => i.neighborhoodId === neighborhoodId));
  },
  async getInstitution(id) {
    return mockDelay(useStore.getState().institutions.find((i) => i.id === id));
  },
};
