import type { Issue, IssueUpdate } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface IssueService {
  getIssues(neighborhoodId: string): Promise<Issue[]>;
  getIssue(id: string): Promise<Issue | undefined>;
  getUpdates(issueId: string): Promise<IssueUpdate[]>;
  createIssue(input: Omit<Issue, 'id' | 'reporterId' | 'status' | 'affectedUserIds' | 'followerIds' | 'createdAt'>): Promise<Issue>;
  markAffected(issueId: string): Promise<void>;
  toggleFollow(issueId: string): Promise<void>;
  /** Demo-only: lets a moderator/dev step the issue through its status timeline. */
  setStatus(issueId: string, status: Issue['status'], note?: string): Promise<void>;
}

export const issueService: IssueService = {
  async getIssues(neighborhoodId) {
    return mockDelay(
      useStore
        .getState()
        .issues.filter((i) => i.neighborhoodId === neighborhoodId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    );
  },
  async getIssue(id) {
    return mockDelay(useStore.getState().issues.find((i) => i.id === id));
  },
  async getUpdates(issueId) {
    return mockDelay(
      useStore
        .getState()
        .issueUpdates.filter((u) => u.issueId === issueId)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
      200,
    );
  },
  async createIssue(input) {
    return mockDelay(useStore.getState().createIssue(input), 400);
  },
  async markAffected(issueId) {
    useStore.getState().markIssueAffected(issueId);
    return mockDelay(undefined, 200);
  },
  async toggleFollow(issueId) {
    useStore.getState().toggleFollowIssue(issueId);
    return mockDelay(undefined, 150);
  },
  async setStatus(issueId, status, note) {
    useStore.getState().setIssueStatus(issueId, status, note);
    return mockDelay(undefined, 200);
  },
};
