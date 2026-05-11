import { Injectable } from '@angular/core';
import { SCORING } from '../config/scoring.config';
import { Match, Palpite } from '../models';

@Injectable({ providedIn: 'root' })
export class ScoringService {
  calculatePalpitePoints(palpite: Palpite, match: Match): number {
    if (
      match.status !== 'finished' ||
      match.homeScore === null ||
      match.awayScore === null
    ) {
      return 0;
    }

    const isGroupStage = match.phase === 'group-stage';
    const rules = isGroupStage ? SCORING.groupStage : SCORING.knockout;

    const rh = match.homeScore;
    const ra = match.awayScore;
    const gh = palpite.scoreHome;
    const ga = palpite.scoreAway;

    const realWinner = Math.sign(rh - ra);
    const guessWinner = Math.sign(gh - ga);

    if (gh === rh && ga === ra) {
      return realWinner === 0 ? rules.exactDraw : rules.exactScore;
    }

    if (realWinner === guessWinner) {
      if (realWinner === 0) return rules.correctDraw;
      if (gh === rh || ga === ra) return rules.correctWinnerAndOneScore;
      return rules.correctWinner;
    }

    // Errou o ganhador — no mata-mata pode ainda ganhar ponto por acertar pênaltis
    if (!isGroupStage && realWinner === 0) {
      // Jogo terminou empatado no regulamentar (decidido nos pênaltis)
      // Se o usuário apostou no vencedor dos pênaltis, ganha correctQualifier
      if (palpite.tiebreakTeamId && match.penaltyWinnerId === palpite.tiebreakTeamId) {
        return SCORING.knockout.correctQualifier;
      }
    }

    return rules.wrongWinner;
  }
}
