import {
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { Match, Palpite, Team } from '../../../core/models';
import { ScoringService } from '../../../core/services/scoring.service';

@Component({
  selector: 'app-match-card',
  templateUrl: './match-card.component.html',
  styleUrls: ['./match-card.component.css'],
})
export class MatchCardComponent {
  @Input() match!: Match;
  @Input() homeTeam!: Team | undefined;
  @Input() awayTeam!: Team | undefined;
  @Input() palpite: Palpite | null = null;
  @Input() locked = false;

  @Output() palpiteChange = new EventEmitter<{
    matchId: string;
    scoreHome: number;
    scoreAway: number;
    tiebreakTeamId?: string;
  }>();

  scoreHome: number | null = null;
  scoreAway: number | null = null;
  tiebreakTeamId: string | null = null;

  constructor(private scoring: ScoringService) {}

  get isKnockout(): boolean {
    return this.match.phase !== 'group-stage';
  }

  get showTiebreak(): boolean {
    return (
      this.isKnockout &&
      !this.locked &&
      this.scoreHome !== null &&
      this.scoreAway !== null &&
      this.scoreHome === this.scoreAway
    );
  }

  get earnedPoints(): number | null {
    if (!this.palpite || this.match.status !== 'finished') return null;
    return this.scoring.calculatePalpitePoints(this.palpite, this.match);
  }

  ngOnChanges(): void {
    this.scoreHome = this.palpite?.scoreHome ?? null;
    this.scoreAway = this.palpite?.scoreAway ?? null;
    this.tiebreakTeamId = this.palpite?.tiebreakTeamId ?? null;
  }

  onChange(): void {
    if (this.scoreHome === null || this.scoreAway === null) return;
    if (this.scoreHome < 0 || this.scoreAway < 0) return;

    // Se não é mais empate, limpar o tiebreak
    if (this.scoreHome !== this.scoreAway) {
      this.tiebreakTeamId = null;
    }

    this.emit();
  }

  selectTiebreak(teamId: string): void {
    this.tiebreakTeamId = teamId;
    this.emit();
  }

  private emit(): void {
    const payload: { matchId: string; scoreHome: number; scoreAway: number; tiebreakTeamId?: string } = {
      matchId: this.match.id,
      scoreHome: this.scoreHome!,
      scoreAway: this.scoreAway!,
    };
    if (this.tiebreakTeamId) {
      payload.tiebreakTeamId = this.tiebreakTeamId;
    }
    this.palpiteChange.emit(payload);
  }

  formatDate(): string {
    if (!this.match.date) return '';
    const d = new Date(this.match.date);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  get statusLabel(): string {
    if (this.match.status === 'in-progress') return 'Ao vivo';
    if (this.match.status === 'finished') return 'Encerrado';
    return this.formatDate();
  }

  get statusBadgeClass(): string {
    if (this.match.status === 'in-progress') return 'badge-red';
    if (this.match.status === 'finished') return 'badge-muted';
    return 'badge-green';
  }

  get hasResult(): boolean {
    return (
      this.match.status !== 'scheduled' &&
      this.match.homeScore !== null &&
      this.match.awayScore !== null
    );
  }
}
