export type ReplaySource =
  | 'user'
  | 'scenario'
  | 'rhythm'
  | 'physiology'
  | 'team'
  | 'pendingOrder'
  | 'score'
  | 'system';

export interface ReplayEvent {
  timestamp: number;
  source: ReplaySource;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface ReplayState {
  events: ReplayEvent[];
}
