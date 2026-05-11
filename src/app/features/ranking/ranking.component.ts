import { Component, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { RankingEntry } from '../../core/models';
import { EspnService } from '../../core/services/espn.service';
import { RankingService } from '../../core/services/ranking.service';

const ENTRY_FEE = 20;
const PRIZES = [
  { place: 1, emoji: '🥇', label: '1º lugar', pct: 0.65, color: 'gold' },
  { place: 2, emoji: '🥈', label: '2º lugar', pct: 0.25, color: 'silver' },
  { place: 3, emoji: '🥉', label: '3º lugar', pct: 0.10, color: 'bronze' },
];

@Component({
  selector: 'app-ranking',
  templateUrl: './ranking.component.html',
  styleUrls: ['./ranking.component.css'],
})
export class RankingComponent implements OnInit {
  loading = true;
  error = '';
  ranking: RankingEntry[] = [];
  detailEntry: RankingEntry | null = null;

  playerCount = 0;
  readonly prizes = PRIZES;
  readonly entryFee = ENTRY_FEE;

  constructor(
    private espn: EspnService,
    private rankingService: RankingService,
    private afs: AngularFirestore,
  ) {}

  get totalPot(): number {
    return this.playerCount * this.entryFee;
  }

  prizeAmount(pct: number): number {
    return Math.floor(this.totalPot * pct);
  }

  ngOnInit(): void {
    // Contar jogadores (usuários autenticados na coleção users)
    this.afs.collection('users').valueChanges().pipe(
      map((users) => users.length)
    ).subscribe((count) => (this.playerCount = count));

    const allMatches$ = combineLatest([
      this.espn.getMatches('20260611', '20260628'),
      this.espn.getMatches('20260628', '20260719'),
    ]).pipe(switchMap(([a, b]) => this.rankingService.getRanking([...a, ...b])));

    allMatches$.subscribe({
      next: (entries) => {
        this.ranking = entries;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.message ?? 'Erro ao carregar ranking.';
        this.loading = false;
      },
    });
  }

  trackByUid(_i: number, entry: RankingEntry): string {
    return entry.uid;
  }

  positionClass(pos?: number): string {
    if (pos === 1) return 'gold';
    if (pos === 2) return 'silver';
    if (pos === 3) return 'bronze';
    return '';
  }

  openDetail(entry: RankingEntry): void {
    this.detailEntry = entry;
  }

  closeDetail(): void {
    this.detailEntry = null;
  }

  positionEmoji(pos?: number): string {
    if (pos === 1) return '🥇';
    if (pos === 2) return '🥈';
    if (pos === 3) return '🥉';
    return '';
  }
}
