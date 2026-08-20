import type { Conversation, Message } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface MessageService {
  getConversations(userId: string): Promise<Conversation[]>;
  getMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, text: string, image?: string): Promise<Message>;
  getOrCreateConversation(otherUserId: string): Promise<Conversation>;
  markConversationRead(conversationId: string): Promise<void>;
}

export const messageService: MessageService = {
  async getConversations(userId) {
    return mockDelay(
      useStore
        .getState()
        .conversations.filter((c) => c.participantIds.includes(userId))
        .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)),
    );
  },
  async getMessages(conversationId) {
    return mockDelay(
      useStore
        .getState()
        .messages.filter((m) => m.conversationId === conversationId)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
      250,
    );
  },
  async sendMessage(conversationId, text, image) {
    return mockDelay(useStore.getState().sendMessage(conversationId, text, image), 150);
  },
  async getOrCreateConversation(otherUserId) {
    return mockDelay(useStore.getState().getOrCreateConversation(otherUserId), 150);
  },
  async markConversationRead(conversationId) {
    useStore.getState().markConversationRead(conversationId);
    return mockDelay(undefined, 80);
  },
};
