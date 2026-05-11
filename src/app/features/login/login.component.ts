import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';

interface ConfettiPiece {
  style: { [key: string]: string };
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  loading = false;
  error = '';
  confettiPieces: ConfettiPiece[] = [];

  private readonly COLORS = [
    '#ffd700', '#ffe566', '#ffffff',
    '#006847', '#4ade80', '#00a86b',
    '#ffc107', '#a3e635',
  ];

  constructor(private auth: AuthService, private router: Router) {
    this.auth.user$.pipe(take(1)).subscribe((user) => {
      if (user) this.router.navigate(['/grupos']);
    });
  }

  ngOnInit(): void {
    this.generateConfetti();
  }

  private generateConfetti(): void {
    this.confettiPieces = Array.from({ length: 55 }, (_, i) => {
      const color = this.COLORS[i % this.COLORS.length];
      const left = Math.random() * 100;
      const delay = Math.random() * 2.8;
      const duration = 2.4 + Math.random() * 2.2;
      const size = 6 + Math.random() * 8;
      const rotate = Math.floor(Math.random() * 360);
      const shape = Math.random() > 0.45 ? '50%' : '2px';
      return {
        style: {
          left: `${left}vw`,
          top: `-${size * 2}px`,
          width: `${size}px`,
          height: `${size * (Math.random() > 0.5 ? 1 : 2.2)}px`,
          background: color,
          borderRadius: shape,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          transform: `rotate(${rotate}deg)`,
          opacity: `${0.7 + Math.random() * 0.3}`,
        },
      };
    });
  }

  async signIn(): Promise<void> {
    this.error = '';
    this.loading = true;
    try {
      await this.auth.signInWithGoogle();
      this.router.navigate(['/grupos']);
    } catch (e: any) {
      this.error = e?.message ?? 'Falha ao entrar com o Google.';
    } finally {
      this.loading = false;
    }
  }
}
