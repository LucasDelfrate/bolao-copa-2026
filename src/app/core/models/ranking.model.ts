export interface PhaseBreakdown {
  exactScores: number;
  exactScoresPoints: number;
  exactDraws: number;
  exactDrawsPoints: number;
  correctWinnerAndOneScore: number;
  correctWinnerAndOneScorePoints: number;
  correctWinners: number;
  correctWinnersPoints: number;
  correctDraws: number;
  correctDrawsPoints: number;
  wrongWinners: number;
  wrongWinnersPoints: number;
  subtotal: number;
}

export interface PointsBreakdown {
  groups: PhaseBreakdown;
  knockout: PhaseBreakdown;
  correctQualifiers: number;
  correctQualifiersPoints: number;
  podiumPicks: number;
  podiumPicksPoints: number;
  championBonus: number;
  total: number;
}

export interface RankingEntry {
  uid: string;
  displayName: string;
  photoURL: string;
  totalPoints: number;
  exactScores: number;
  correctWinners: number;
  wrongWinnersPoints: number;
  position?: number;
  breakdown?: PointsBreakdown;
}
