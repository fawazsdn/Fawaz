import type { Comment, MarketplaceListing, Post, ReportTargetType, User } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export type ModerationReport = ReturnType<typeof useStore.getState>['reports'][number];

export interface ModerationService {
  getReports(status?: ModerationReport['status']): Promise<ModerationReport[]>;
  moderate(reportId: string, status: 'reviewed' | 'dismissed' | 'actioned'): Promise<void>;
  removeContent(targetType: ReportTargetType, targetId: string): Promise<void>;
  resolveTarget(report: ModerationReport): { post?: Post; comment?: Comment; user?: User; listing?: MarketplaceListing };
}

export const moderationService: ModerationService = {
  async getReports(status) {
    const reports = useStore.getState().reports;
    return mockDelay(status ? reports.filter((r) => r.status === status) : reports);
  },
  async moderate(reportId, status) {
    useStore.getState().moderateReport(reportId, status);
    return mockDelay(undefined, 200);
  },
  async removeContent(targetType, targetId) {
    useStore.getState().removeContent(targetType, targetId);
    return mockDelay(undefined, 200);
  },
  resolveTarget(report) {
    const s = useStore.getState();
    if (report.targetType === 'post') return { post: s.posts.find((p) => p.id === report.targetId) };
    if (report.targetType === 'comment') return { comment: s.comments.find((c) => c.id === report.targetId) };
    if (report.targetType === 'user') return { user: s.users.find((u) => u.id === report.targetId) };
    if (report.targetType === 'listing') return { listing: s.marketplaceListings.find((m) => m.id === report.targetId) };
    return {};
  },
};
