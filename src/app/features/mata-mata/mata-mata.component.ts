import { Component, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import {
  BracketBonus,
  Match,
  MatchPhase,
  Palpite,
  Team,
} from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { EspnService } from '../../core/services/espn.service';
import { PalpitesService } from '../../core/services/palpites.service';

interface PhaseSection {
  phase: MatchPhase;
  label: string;
  matches: Match[];
  locked: boolean;
  firstMatchDate?: Date;
}

type BracketField = 'championTeamId' | 'runnerUpTeamId' | 'thirdPlaceTeamId' | 'fourthPlaceTeamId';

export interface BracketPick {
  field: BracketField;
  icon: string;
  label: string;
}

const PHASE_ORDER: MatchPhase[] = [
  'round-of-32',
  'round-of-16',
  'quarterfinals',
  'semifinals',
  'third-place',
  'final',
];

const PHASE_LABEL: Record<MatchPhase, string> = {
  'group-stage': 'Fase de Grupos',
  'round-of-32': '16-avos de final',
  'round-of-16': 'Oitavas de final',
  quarterfinals: 'Quartas de final',
  semifinals: 'Semifinais',
  'third-place': 'Disputa de 3º lugar',
  final: 'Final',
};

export const BRACKET_PICKS: BracketPick[] = [
  { field: 'championTeamId',   icon: '🏆', label: 'Campeão'     },
  { field: 'runnerUpTeamId',   icon: '🥈', label: 'Vice'        },
  { field: 'thirdPlaceTeamId', icon: '🥉', label: '3º lugar'    },
  { field: 'fourthPlaceTeamId',icon: '4️⃣', label: '4º lugar'    },
];

@Component({
  selector: 'app-mata-mata',
  templateUrl: './mata-mata.component.html',
  styleUrls: ['./mata-mata.component.css'],
})
export class MataMataComponent implements OnInit {
  loading = true;
  error = '';
  uid = '';

  teamsById = new Map<string, Team>();
  palpitesByMatchId = new Map<string, Palpite>();
  sections: PhaseSection[] = [];

  bracket: BracketBonus = { uid: '', updatedAt: 0 };
  bracketLocked = false;
  bracketDeadline?: Date;
  topTeams: Team[] = [];

  readonly bracketPicks = BRACKET_PICKS;

  // Modal state
  modalOpen = false;
  modalPick: BracketPick | null = null;
  modalSearch = '';
  modalTempId: string | null = null;

  constructor(
    private espn: EspnService,
    private palpites: PalpitesService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.auth.user$.pipe(take(1)).subscribe((user) => {
      if (!user) {
        this.error = 'Não autenticado.';
        this.loading = false;
        return;
      }
      this.uid = user.uid;
      this.loadData();
    });
  }

  // ── Limpar palpites ───────────────────────────────────────────────────────

  clearModalOpen = false;
  clearLoading = false;

  openClearModal(): void { this.clearModalOpen = true; }
  closeClearModal(): void { this.clearModalOpen = false; }

  async confirmClear(): Promise<void> {
    this.clearLoading = true;
    try {
      const knockoutPhases = PHASE_ORDER;
      for (const phase of knockoutPhases) {
        await this.palpites.clearPalpitesByPhase(this.uid, phase);
      }
      this.palpitesByMatchId = new Map();
    } catch (e: any) {
      this.error = e?.message ?? 'Erro ao limpar palpites.';
    } finally {
      this.clearLoading = false;
      this.clearModalOpen = false;
    }
  }

  // ── Modal ────────────────────────────────────────────────────────────────

  openModal(pick: BracketPick): void {
    if (this.bracketLocked) return;
    this.modalPick = pick;
    this.modalTempId = (this.bracket[pick.field] as string) || null;
    this.modalSearch = '';
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
    this.modalPick = null;
    this.modalTempId = null;
    this.modalSearch = '';
  }

  confirmModal(): void {
    if (!this.modalPick || !this.modalTempId) return;
    const field = this.modalPick.field;
    this.bracket = { ...this.bracket, [field]: this.modalTempId };
    this.palpites
      .saveBracket(this.uid, this.bracket)
      .catch((err) => (this.error = err?.message ?? 'Erro ao salvar.'));
    this.closeModal();
  }

  get filteredTeams(): Team[] {
    if (!this.modalSearch.trim()) return this.topTeams;
    const q = this.modalSearch.toLowerCase();
    return this.topTeams.filter((t) => t.name.toLowerCase().includes(q));
  }

  getPickTeam(pick: BracketPick): Team | undefined {
    const id = this.bracket[pick.field] as string | undefined;
    return id ? this.teamsById.get(id) : undefined;
  }

  // ── Fases ────────────────────────────────────────────────────────────────

  trackPhase(_i: number, s: PhaseSection): string { return s.phase; }
  trackMatch(_i: number, m: Match): string { return m.id; }

  onPalpite(event: { matchId: string; scoreHome: number; scoreAway: number; tiebreakTeamId?: string }): void {
    const match = this.findMatch(event.matchId);
    if (!match) return;
    const section = this.sections.find((s) => s.phase === match.phase);
    if (section?.locked) return;

    const payload: Omit<Palpite, 'id' | 'updatedAt'> = {
      uid: this.uid,
      matchId: event.matchId,
      phase: match.phase,
      scoreHome: event.scoreHome,
      scoreAway: event.scoreAway,
    };
    if (event.tiebreakTeamId) payload.tiebreakTeamId = event.tiebreakTeamId;

    this.palpites
      .savePalpite(payload)
      .catch((err) => (this.error = err?.message ?? 'Erro ao salvar.'));
  }

  getPalpite(matchId: string): Palpite | null {
    return this.palpitesByMatchId.get(matchId) ?? null;
  }

  getTeam(teamId: string): Team | undefined {
    return this.teamsById.get(teamId);
  }

  isMatchDefined(m: Match): boolean {
    return !!this.teamsById.get(m.homeTeamId) && !!this.teamsById.get(m.awayTeamId);
  }

  private findMatch(matchId: string): Match | undefined {
    for (const s of this.sections) {
      const m = s.matches.find((x) => x.id === matchId);
      if (m) return m;
    }
    return undefined;
  }

  private loadData(): void {
    const matches$ = this.espn.getMatches('20260628', '20260719');
    const teams$ = this.espn.getTeams();
    const groupMatches$ = this.espn.getMatches('20260611', '20260628');

    combineLatest([teams$, matches$, groupMatches$])
      .pipe(
        switchMap(([teams, knockoutMatches, groupMatches]) => {
          this.teamsById = new Map(teams.map((t) => [t.id, t]));
          this.topTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

          const knockoutOnly = knockoutMatches.filter((m) => m.phase !== 'group-stage');
          if (knockoutOnly.length) {
            const first = [...knockoutOnly].sort((a, b) => a.date.localeCompare(b.date))[0];
            this.bracketDeadline = new Date(first.date);
            // Trava se a data já passou OU se algum jogo do mata-mata já começou/terminou
            const anyStarted = knockoutOnly.some((m) => m.status === 'in-progress' || m.status === 'finished');
            this.bracketLocked = Date.now() >= this.bracketDeadline.getTime() || anyStarted;
          }

          this.sections = PHASE_ORDER.map((phase) => {
            const phaseMatches = knockoutOnly
              .filter((m) => m.phase === phase)
              .sort((a, b) => a.date.localeCompare(b.date));

            let firstMatchDate: Date | undefined;
            let locked = false;
            if (phaseMatches.length) {
              firstMatchDate = new Date(phaseMatches[0].date);
              // Trava se a data já passou OU se algum jogo dessa fase já começou/terminou
              const phaseStarted = phaseMatches.some((m) => m.status === 'in-progress' || m.status === 'finished');
              locked = Date.now() >= firstMatchDate.getTime() || phaseStarted;
            }

            return { phase, label: PHASE_LABEL[phase], matches: phaseMatches, locked, firstMatchDate };
          }).filter((s) => s.matches.length > 0);

          return combineLatest([
            this.palpites.getMyPalpites(this.uid),
            this.palpites.getBracket(this.uid),
          ]);
        }),
      )
      .subscribe({
        next: ([palpites, bracket]) => {
          this.palpitesByMatchId = new Map(palpites.map((p) => [p.matchId, p]));
          this.bracket = bracket ?? { uid: this.uid, updatedAt: 0 };
          this.loading = false;
        },
        error: (err) => {
          this.error = err?.message ?? 'Erro ao carregar dados.';
          this.loading = false;
        },
      });
  }

  bracketDeadlineLabel(): string {
    if (!this.bracketDeadline) return '';
    return this.bracketDeadline.toLocaleString('pt-BR', {
      day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
    });
  }

  phaseDeadlineLabel(s: PhaseSection): string {
    if (!s.firstMatchDate) return '';
    return s.firstMatchDate.toLocaleString('pt-BR', {
      day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
    });
  }
}
