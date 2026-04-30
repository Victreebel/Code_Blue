export type ScoreBucketId =
  | 'acls_timing'
  | 'cpr_continuity'
  | 'defib_med'
  | 'delegation_clc'
  | 'leadership_chaos';

export interface ScoreBucket {
  id: ScoreBucketId;
  label: string;
  max: number;
  awarded: number;
  arithmetic: string;
  reasons: string[];
}

export interface ScoreReport {
  total: number;
  generatedAt: number;
  aclsTiming: ScoreBucket;
  cprContinuity: ScoreBucket;
  defibMed: ScoreBucket;
  delegationClc: ScoreBucket;
  leadershipChaos: ScoreBucket;
  buckets: ScoreBucket[];
  arithmetic: Record<ScoreBucketId, string>;
  strengths: string[];
  misses: string[];
  teachingPoints: string[];
}
