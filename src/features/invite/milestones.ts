export interface ReferralMilestone {
  key: string;
  threshold: number;
  titleAr: string;
  titleEn: string;
}

/** Badge thresholds, counted against server-attributed joins (referral_events 'signup_attributed'). */
export const REFERRAL_MILESTONES: ReferralMilestone[] = [
  { key: 'connector', threshold: 3, titleAr: 'الرابط', titleEn: 'Connector' },
  { key: 'ambassador', threshold: 10, titleAr: 'سفير الحي', titleEn: 'Neighborhood Ambassador' },
  { key: 'founding', threshold: 25, titleAr: 'جار مؤسس', titleEn: 'Founding Neighbor' },
  { key: 'builder', threshold: 50, titleAr: 'باني المجتمع', titleEn: 'Community Builder' },
];
