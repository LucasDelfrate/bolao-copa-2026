import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  loading = false;
  error = '';

  constructor(private auth: AuthService, private router: Router) {
    this.auth.user$.pipe(take(1)).subscribe((user) => {
      if (user) {
        this.router.navigate(['/grupos']);
      }
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
