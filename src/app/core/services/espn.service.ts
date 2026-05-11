import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { TEAM_NAMES_PT } from '../config/team-names';
import { Group, Match, MatchPhase, MatchStatus, Team } from '../models';

const PHASE_BY_SLUG: Record<string, MatchPhase> = {
  'group-stage': 'group-stage',
  'round-of-32': 'round-of-32',
  'round-of-16': 'round-of-16',
  quarterfinals: 'quarterfinals',
  semifinals: 'semifinals',
  '3rd-place-match': 'third-place',
  final: 'final',
};

@Injectable({ providedIn: 'root' })
export class EspnService {
  constructor(private http: HttpClient) {}

  getTeams(): Observable<Team[]> {
    return this.http.get<any>(environment.espn.teams).pipe(
      map((res) => {
        const sports = res?.sports?.[0]?.leagues?.[0]?.teams ?? [];
        return sports.map((entry: any) => this.mapTeam(entry.team));
      }),
      catchError((err) => {
        console.error('[EspnService] getTeams error:', err);
        return of<Team[]>([]);
      })
    );
  }

  getGroups(): Observable<Group[]> {
    return this.http.get<any>(environment.espn.groups).pipe(
      switchMap((res) => {
        // Resposta: { count, items: [{ $ref: '...' }, ...] }
        const items: { $ref: string }[] = res?.items ?? [];
        if (!items.length) {
          console.warn('[EspnService] getGroups: nenhum item retornado', res);
          return of<Group[]>([]);
        }
        // Extrai o ID do grupo a partir da ref (ex.: .../groups/1 → "1")
        const calls = items.map((item) => {
          const id = this.extractGroupIdFromRef(item.$ref);
          return this.fetchGroupById(id);
        });
        return forkJoin(calls);
      }),
      catchError((err) => {
        console.error('[EspnService] getGroups error:', err);
        return of<Group[]>([]);
      })
    );
  }

  getMatches(startDate: string, endDate: string): Observable<Match[]> {
    const url = `${environment.espn.scoreboard}?dates=${startDate}-${endDate}&limit=200`;
    return this.http.get<any>(url).pipe(
      map((res) => {
        const events: any[] = res?.events ?? [];
        return events.map((ev) => this.mapMatch(ev));
      }),
      catchError((err) => {
        console.error('[EspnService] getMatches error:', err);
        return of<Match[]>([]);
      })
    );
  }

  // Busca detalhe + standings via proxy (sem CORS)
  private fetchGroupById(id: string): Observable<Group> {
    const base = environment.espn.groups;
    // Suporta tanto proxy local (/api/groups/3) quanto serverless (/api/groups?id=3)
    const detailUrl = base.startsWith('http')
      ? `${base}/${id}`
      : `${base}?id=${id}`;
    const standingsUrl = base.startsWith('http')
      ? `${base}/${id}/standings`
      : `${base}?id=${id}&standings=1`;

    return this.http.get<any>(detailUrl).pipe(
      switchMap((groupData) =>
        this.http.get<any>(standingsUrl).pipe(
          map((standingsData) => {
            const standingsList: any[] = standingsData?.standings ?? [];
            const teamIds = standingsList
              .map((s: any) => this.extractTeamIdFromRef(s?.team?.$ref))
              .filter((tid): tid is string => !!tid);

            const abbr: string = groupData?.abbreviation ?? '';
            const letter = abbr.replace(/^Group\s+/i, '').trim() || String(id);

            return {
              id: String(groupData?.id ?? id),
              letter,
              name: groupData?.name ?? `Grupo ${letter}`,
              teamIds,
            };
          })
        )
      ),
      catchError((err) => {
        console.error(`[EspnService] fetchGroupById(${id}) error:`, err);
        return of<Group>({ id: String(id), letter: '?', name: `Grupo ${id}`, teamIds: [] });
      })
    );
  }

  private extractGroupIdFromRef(ref: string): string {
    // ex.: http://sports.core.api.espn.com/.../groups/3
    const match = ref.match(/\/groups\/(\d+)/);
    return match ? match[1] : '0';
  }

  private extractTeamIdFromRef(ref?: string): string | null {
    if (!ref) return null;
    const match = ref.match(/teams\/(\d+)/);
    return match ? match[1] : null;
  }

  private mapTeam(team: any): Team {
    const logos: any[] = team?.logos ?? [];
    const nameEn: string = team?.displayName ?? team?.name ?? '';
    return {
      id: String(team?.id ?? ''),
      name: TEAM_NAMES_PT[nameEn] ?? nameEn,
      abbreviation: team?.abbreviation ?? '',
      slug: team?.slug ?? '',
      logo:
        logos[0]?.href ??
        `https://a.espncdn.com/i/teamlogos/countries/500/${(team?.abbreviation ?? '').toLowerCase()}.png`,
      color: team?.color,
      alternateColor: team?.alternateColor,
    };
  }

  private mapMatch(ev: any): Match {
    const competition = ev?.competitions?.[0] ?? {};
    const competitors: any[] = competition?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === 'home');
    const away = competitors.find((c) => c.homeAway === 'away');
    const phaseSlug: string = ev?.season?.slug ?? 'group-stage';
    const statusName: string = ev?.status?.type?.name ?? 'STATUS_SCHEDULED';

    const status = this.mapStatus(statusName);
    // ESPN retorna score "0" mesmo para jogos ainda não iniciados — tratar como null
    const hasScore = status !== 'scheduled';

    return {
      id: String(ev?.id ?? ''),
      date: ev?.date ?? '',
      phase: PHASE_BY_SLUG[phaseSlug] ?? 'group-stage',
      groupLetter: ev?.groupLetter,
      homeTeamId: String(home?.team?.id ?? home?.id ?? ''),
      awayTeamId: String(away?.team?.id ?? away?.id ?? ''),
      homeScore: hasScore ? this.parseScore(home?.score) : null,
      awayScore: hasScore ? this.parseScore(away?.score) : null,
      penaltyWinnerId: ev?.penaltyWinnerId ?? undefined,
      status,
      venue: competition?.venue?.fullName,
    };
  }

  private parseScore(score: any): number | null {
    if (score === null || score === undefined || score === '') return null;
    const n = Number(score);
    return Number.isFinite(n) ? n : null;
  }

  private mapStatus(statusName: string): MatchStatus {
    if (statusName === 'STATUS_FINAL' || statusName === 'STATUS_FULL_TIME') return 'finished';
    if (statusName === 'STATUS_IN_PROGRESS' || statusName === 'STATUS_HALFTIME') return 'in-progress';
    return 'scheduled';
  }
}
