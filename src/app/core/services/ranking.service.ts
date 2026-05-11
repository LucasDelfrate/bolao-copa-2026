import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SCORING } from '../config/scoring.config';
import {
  AppUser,
  BracketBonus,
  Match,
  Palpite,
  PhaseBreakdown,
  PointsBreakdown,
  RankingEntry,
} from '../models';

@Injectable({ providedIn: 'root' })
export class RankingService {
  constructor(private afs: AngularFirestore) {}

  getRanking(matches: Match[]): Observable<RankingEntry[]> {
    const users$ = this.afs.collection<AppUser>('users').valueChanges();
    const palpites$ = this.afs.collection<Palpite>('palpites').valueChanges();
    const bracket$ = this.afs.collection<BracketBonus>('bracket').valueChanges();

    return combineLatest([users$, palpites$, bracket$]).pipe(
      map(([users, palpites, brackets]) =>
        this.compute(users, palpites, brackets, matches),
      ),
    );
  }

  private emptyPhase(): PhaseBreakdown {
    return {
      exactScores: 0, exactScoresPoints: 0,
      exactDraws: 0, exactDrawsPoints: 0,
      correctWinnerAndOneScore: 0, correctWinnerAndOneScorePoints: 0,
      correctWinners: 0, correctWinnersPoints: 0,
      correctDraws: 0, correctDrawsPoints: 0,
      wrongWinners: 0, wrongWinnersPoints: 0,
      subtotal: 0,
    };
  }

  private accumulatePhase(
    phase: PhaseBreakdown,
    rules: typeof SCORING.groupStage | typeof SCORING.knockout,
    rh: number, ra: number,
    gh: number, ga: number,
    penaltyWinnerId?: string,
    tiebreakTeamId?: string,
  ): void {
    const realWinner = Math.sign(rh - ra);
    const guessWinner = Math.sign(gh - ga);

    if (gh === rh && ga === ra) {
      if (realWinner === 0) {
        phase.exactDraws++; phase.exactDrawsPoints += rules.exactDraw;
      } else {
        phase.exactScores++; phase.exactScoresPoints += rules.exactScore;
      }
    } else if (realWinner === guessWinner) {
      if (realWinner === 0) {
        phase.correctDraws++; phase.correctDrawsPoints += rules.correctDraw;
      } else if (gh === rh || ga === ra) {
        phase.correctWinnerAndOneScore++;
        phase.correctWinnerAndOneScorePoints += rules.correctWinnerAndOneScore;
      } else {
        phase.correctWinners++; phase.correctWinnersPoints += rules.correctWinner;
      }
    } else {
      // Errou o ganhador: no mata-mata pode ainda acertar pênaltis
      if (penaltyWinnerId && tiebreakTeamId && penaltyWinnerId === tiebreakTeamId) {
        // correctQualifier não existe na interface de phaseBreakdown ainda — usar wrongWinners com pts 0
        // Registrar como acerto de pênaltis separado via wrongWinnersPoints ajustado
        phase.wrongWinners++; phase.wrongWinnersPoints += SCORING.knockout.correctQualifier;
      } else {
        phase.wrongWinners++; phase.wrongWinnersPoints += rules.wrongWinner;
      }
    }

    phase.subtotal =
      phase.exactScoresPoints + phase.exactDrawsPoints +
      phase.correctWinnerAndOneScorePoints + phase.correctWinnersPoints +
      phase.correctDrawsPoints + phase.wrongWinnersPoints;
  }

  private compute(
    users: AppUser[],
    palpites: Palpite[],
    brackets: BracketBonus[],
    matches: Match[],
  ): RankingEntry[] {
    const matchById = new Map(matches.map((m) => [m.id, m]));
    const finishedMatches = matches.filter((m) => m.status === 'finished');

    const champion = this.findFinalWinner(finishedMatches);
    const runnerUp = this.findFinalLoser(finishedMatches);
    const thirdPlace = this.findThirdPlaceWinner(finishedMatches);
    const fourthPlace = this.findThirdPlaceLoser(finishedMatches);
    const podium = [champion, runnerUp, thirdPlace, fourthPlace];

    const bracketByUid = new Map(brackets.map((b) => [b.uid, b]));

    const entries: RankingEntry[] = users.map((u) => {
      const groups = this.emptyPhase();
      const knockout = this.emptyPhase();
      const bd: PointsBreakdown = {
        groups,
        knockout,
        correctQualifiers: 0,
        correctQualifiersPoints: 0,
        podiumPicks: 0,
        podiumPicksPoints: 0,
        championBonus: 0,
        total: 0,
      };

      for (const p of palpites.filter((p) => p.uid === u.uid)) {
        const m = matchById.get(p.matchId);
        if (!m || m.status !== 'finished' || m.homeScore === null || m.awayScore === null) continue;
        const isGroup = m.phase === 'group-stage';
        const rules = isGroup ? SCORING.groupStage : SCORING.knockout;
        this.accumulatePhase(
          isGroup ? groups : knockout, rules,
          m.homeScore, m.awayScore, p.scoreHome, p.scoreAway,
          m.penaltyWinnerId, p.tiebreakTeamId,
        );
      }

      const userBracket = bracketByUid.get(u.uid);
      if (userBracket) {
        if (champion && userBracket.championTeamId === champion) {
          bd.championBonus = SCORING.preCopaChampion;
        }
        const picks = [
          { pick: userBracket.championTeamId, expected: champion },
          { pick: userBracket.runnerUpTeamId, expected: runnerUp },
          { pick: userBracket.thirdPlaceTeamId, expected: thirdPlace },
          { pick: userBracket.fourthPlaceTeamId, expected: fourthPlace },
        ];
        for (const { pick, expected } of picks) {
          if (!pick || !podium.includes(pick)) continue;
          bd.podiumPicks++;
          bd.podiumPicksPoints += SCORING.semifinals.inPodium;
          if (pick === expected) bd.podiumPicksPoints += SCORING.semifinals.exactPosition;
        }
      }

      bd.total = groups.subtotal + knockout.subtotal +
        bd.correctQualifiersPoints + bd.podiumPicksPoints + bd.championBonus;

      return {
        uid: u.uid,
        displayName: u.displayName,
        photoURL: u.photoURL,
        totalPoints: bd.total,
        exactScores: groups.exactScores + groups.exactDraws + knockout.exactScores + knockout.exactDraws,
        correctWinners: groups.correctWinners + groups.correctWinnerAndOneScore + knockout.correctWinners + knockout.correctWinnerAndOneScore,
        wrongWinnersPoints: groups.wrongWinnersPoints + knockout.wrongWinnersPoints,
        breakdown: bd,
      };
    });

    entries.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
      // Menos erros = wrongWinnersPoints menos negativo = maior valor (ex: -4 > -10)
      return b.wrongWinnersPoints - a.wrongWinnersPoints;
    });

    entries.forEach((e, i) => (e.position = i + 1));
    return entries;
  }

  private findFinalWinner(matches: Match[]): string | undefined {
    const final = matches.find((m) => m.phase === 'final');
    if (!final || final.homeScore === null || final.awayScore === null) return;
    return final.homeScore > final.awayScore ? final.homeTeamId : final.awayTeamId;
  }

  private findFinalLoser(matches: Match[]): string | undefined {
    const final = matches.find((m) => m.phase === 'final');
    if (!final || final.homeScore === null || final.awayScore === null) return;
    return final.homeScore > final.awayScore ? final.awayTeamId : final.homeTeamId;
  }

  private findThirdPlaceWinner(matches: Match[]): string | undefined {
    const m = matches.find((x) => x.phase === 'third-place');
    if (!m || m.homeScore === null || m.awayScore === null) return;
    return m.homeScore > m.awayScore ? m.homeTeamId : m.awayTeamId;
  }

  private findThirdPlaceLoser(matches: Match[]): string | undefined {
    const m = matches.find((x) => x.phase === 'third-place');
    if (!m || m.homeScore === null || m.awayScore === null) return;
    return m.homeScore > m.awayScore ? m.awayTeamId : m.homeTeamId;
  }
}
