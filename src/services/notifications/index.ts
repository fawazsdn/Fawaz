import type { AppNotification } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface NotificationService {
  getNotifications(userId: string): Promise<AppNotification[]>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
}

export const notificationService: NotificationService = {
  async getNotifications(userId) {
    return mockDelay(
      useStore
        .getState()
        .notifications.filter((n) => n.userId === userId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    );
  },
  async markRead(id) {
    useStore.getState().markNotificationRead(id);
    return mockDelay(undefined, 60);
  },
  async markAllRead() {
    useStore.getState().markAllNotificationsRead();
    return mockDelay(undefined, 150);
  },
};
