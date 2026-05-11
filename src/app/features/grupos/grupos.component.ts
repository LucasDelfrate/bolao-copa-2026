import { Component, OnInit } from '@angular/core';
import { combineLatest, Observable, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { BracketBonus, Group, Match, Palpite, StandingRow, Team } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { EspnService } from '../../core/services/espn.service';
import { PalpitesService } from '../../core/services/palpites.service';

interface GroupView {
  group: Group;
  teams: Team[];
  matches: Match[];
  standings: StandingRow[];
}

@Component({
  selector: 'app-grupos',
  templateUrl: './grupos.component.html',
  styleUrls: ['./grupos.component.css'],
})
export class GruposComponent implements OnInit {
  loading = true;
  error = '';
  groupViews: GroupView[] = [];
  teamsById = new Map<string, Team>();
  allTeams: Team[] = [];
  palpitesByMatchId = new Map<string, Palpite>();
  selectedGroupLetter: string | null = null;
  phaseLocked = false;
  firstMatchDate: Date | null = null;
  uid = '';

  championId: string | null = null;
  championSaving = false;
  championSearchQuery = '';
  championModalOpen = false;
  championIdTemp: string | null = null;

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
      this.palpites.getBracket(this.uid).pipe(take(1)).subscribe((b) => {
        this.championId = b?.championTeamId ?? null;
      });
    });
  }

  get championTeam(): Team | undefined {
    return this.championId ? this.teamsById.get(this.championId) : undefined;
  }

  get filteredTeams(): Team[] {
    if (!this.championSearchQuery.trim()) return this.allTeams;
    const q = this.championSearchQuery.toLowerCase();
    return this.allTeams.filter((t) => t.name.toLowerCase().includes(q));
  }

  openChampionModal(): void {
    if (this.phaseLocked) return;
    this.championIdTemp = this.championId;
    this.championSearchQuery = '';
    this.championModalOpen = true;
  }

  closeChampionModal(): void {
    this.championModalOpen = false;
    this.championIdTemp = null;
    this.championSearchQuery = '';
  }

  selectChampionTemp(team: Team): void {
    this.championIdTemp = team.id;
  }

  confirmChampion(): void {
    if (!this.championIdTemp) return;
    this.championId = this.championIdTemp;
    this.championSaving = true;
    this.palpites
      .saveBracket(this.uid, { championTeamId: this.championIdTemp })
      .finally(() => (this.championSaving = false));
    this.closeChampionModal();
  }

  clearModalOpen = false;
  clearLoading = false;

  openClearModal(): void { this.clearModalOpen = true; }
  closeClearModal(): void { this.clearModalOpen = false; }

  async confirmClear(): Promise<void> {
    this.clearLoading = true;
    try {
      await this.palpites.clearPalpitesByPhase(this.uid, 'group-stage');
      this.palpitesByMatchId = new Map();
    } catch (e: any) {
      this.error = e?.message ?? 'Erro ao limpar palpites.';
    } finally {
      this.clearLoading = false;
      this.clearModalOpen = false;
    }
  }

  selectGroup(letter: string): void {
    this.selectedGroupLetter = letter === this.selectedGroupLetter ? null : letter;
  }

  onPalpite(event: { matchId: string; scoreHome: number; scoreAway: number; tiebreakTeamId?: string }): void {
    if (this.phaseLocked) return;
    this.palpites
      .savePalpite({
        uid: this.uid,
        matchId: event.matchId,
        phase: 'group-stage',
        scoreHome: event.scoreHome,
        scoreAway: event.scoreAway,
      })
      .catch((err) => (this.error = err?.message ?? 'Erro ao salvar palpite.'));
  }

  trackGroup(_i: number, view: GroupView): string {
    return view.group.id;
  }

  trackMatch(_i: number, match: Match): string {
    return match.id;
  }

  private computeStandings(matches: Match[], teamIds: string[]): StandingRow[] {
    const stats = new Map<string, StandingRow>();
    for (const id of teamIds) {
      stats.set(id, { teamId: id, pos: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, advancing: false });
    }
    for (const m of matches) {
      if (m.status !== 'finished' || m.homeScore === null || m.awayScore === null) continue;
      const home = stats.get(m.homeTeamId);
      const away = stats.get(m.awayTeamId);
      if (!home || !away) continue;
      home.played++; away.played++;
      home.goalsFor += m.homeScore; home.goalsAgainst += m.awayScore;
      away.goalsFor += m.awayScore; away.goalsAgainst += m.homeScore;
      if (m.homeScore > m.awayScore) { home.won++; home.points += 3; away.lost++; }
      else if (m.homeScore < m.awayScore) { away.won++; away.points += 3; home.lost++; }
      else { home.drawn++; home.points++; away.drawn++; away.points++; }
    }
    const rows = [...stats.values()].map((r) => ({ ...r, goalDiff: r.goalsFor - r.goalsAgainst }));
    rows.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
    rows.forEach((r, i) => { r.pos = i + 1; r.advancing = i < 2; });
    return rows;
  }

  private loadData(): void {
    const matches$ = this.espn.getMatches('20260611', '20260628');
    const teams$ = this.espn.getTeams();
    const groups$ = this.espn.getGroups();

    combineLatest([teams$, groups$, matches$])
      .pipe(
        switchMap(([teams, groups, matches]) => {
          console.log('[Grupos] teams:', teams.length, 'groups:', groups.length, 'matches:', matches.length);
          this.teamsById = new Map(teams.map((t) => [t.id, t]));
          this.allTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

          const groupViews: GroupView[] = groups
            .filter((g) => g.teamIds.length > 0)
            .map((group) => {
              const teamIds = new Set(group.teamIds);
              const groupMatches = matches
                .filter(
                  (m) =>
                    m.phase === 'group-stage' &&
                    teamIds.has(m.homeTeamId) &&
                    teamIds.has(m.awayTeamId),
                )
                .sort((a, b) => a.date.localeCompare(b.date));
              return {
                group,
                teams: group.teamIds
                  .map((id) => this.teamsById.get(id))
                  .filter((t): t is Team => !!t),
                matches: groupMatches,
                standings: this.computeStandings(groupMatches, group.teamIds),
              };
            })
            .sort((a, b) => a.group.letter.localeCompare(b.group.letter));

          this.groupViews = groupViews;
          this.selectedGroupLetter = groupViews[0]?.group.letter ?? null;

          const allGroupMatches = groupViews.flatMap((g) => g.matches);
          if (allGroupMatches.length) {
            const firstDate = new Date(
              [...allGroupMatches].sort((a, b) => a.date.localeCompare(b.date))[0].date,
            );
            this.firstMatchDate = firstDate;
            this.phaseLocked = Date.now() >= firstDate.getTime();
          }

          return this.palpites.getMyPalpites(this.uid);
        }),
      )
      .subscribe({
        next: (palpites) => {
          this.palpitesByMatchId = new Map(palpites.map((p) => [p.matchId, p]));
          this.loading = false;
        },
        error: (err) => {
          this.error = err?.message ?? 'Erro ao carregar dados.';
          this.loading = false;
        },
      });
  }

  get selectedGroup(): GroupView | undefined {
    return this.groupViews.find(
      (gv) => gv.group.letter === this.selectedGroupLetter,
    );
  }

  getPalpite(matchId: string): Palpite | null {
    return this.palpitesByMatchId.get(matchId) ?? null;
  }

  getTeam(teamId: string): Team | undefined {
    return this.teamsById.get(teamId);
  }

  get firstMatchLabel(): string {
    if (!this.firstMatchDate) return '';
    return this.firstMatchDate.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
