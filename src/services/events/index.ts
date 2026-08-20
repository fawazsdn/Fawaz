import type { CommunityEvent } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface EventService {
  getEvents(neighborhoodId: string): Promise<CommunityEvent[]>;
  getEvent(id: string): Promise<CommunityEvent | undefined>;
  createEvent(input: Omit<CommunityEvent, 'id' | 'hostId' | 'attendees'>): Promise<CommunityEvent>;
  joinEvent(id: string): Promise<void>;
  leaveEvent(id: string): Promise<void>;
  cancelEvent(id: string): Promise<void>;
}

export const eventService: EventService = {
  async getEvents(neighborhoodId) {
    return mockDelay(
      useStore
        .getState()
        .events.filter((e) => e.neighborhoodId === neighborhoodId)
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    );
  },
  async getEvent(id) {
    return mockDelay(useStore.getState().events.find((e) => e.id === id));
  },
  async createEvent(input) {
    return mockDelay(useStore.getState().createEvent(input), 350);
  },
  async joinEvent(id) {
    useStore.getState().joinEvent(id);
    return mockDelay(undefined, 250);
  },
  async leaveEvent(id) {
    useStore.getState().leaveEvent(id);
    return mockDelay(undefined, 200);
  },
  async cancelEvent(id) {
    useStore.getState().cancelEvent(id);
    return mockDelay(undefined, 200);
  },
};
