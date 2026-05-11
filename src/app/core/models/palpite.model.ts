export interface Palpite {
  id: string;
  uid: string;
  matchId: string;
  phase: string;
  scoreHome: number;
  scoreAway: number;
  tiebreakTeamId?: string;
  points?: number;
  updatedAt: number;
}

export interface BracketBonus {
  uid: string;
  championTeamId?: string;
  runnerUpTeamId?: string;
  thirdPlaceTeamId?: string;
  fourthPlaceTeamId?: string;
  updatedAt: number;
}
