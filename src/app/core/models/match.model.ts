export type MatchPhase =
  | 'group-stage'
  | 'round-of-32'
  | 'round-of-16'
  | 'quarterfinals'
  | 'semifinals'
  | 'third-place'
  | 'final';

export type MatchStatus = 'scheduled' | 'in-progress' | 'finished';

export interface Match {
  id: string;
  date: string;
  phase: MatchPhase;
  groupLetter?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  penaltyWinnerId?: string;
  status: MatchStatus;
  venue?: string;
}
