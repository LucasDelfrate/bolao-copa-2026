import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { InviteService } from '../../core/services/invite.service';

@Component({
  selector: 'app-ativar',
  templateUrl: './ativar.component.html',
  styleUrls: ['./ativar.component.css'],
})
export class AtivarComponent {
  code = '';
  loading = false;
  error = '';
  success = false;

  constructor(
    private invite: InviteService,
    private auth: AuthService,
    private router: Router,
  ) {
    // Se já está aprovado, redireciona
    this.auth.isApproved$.pipe(take(1)).subscribe((approved) => {
      if (approved) this.router.navigate(['/grupos']);
    });
  }

  async redeem(): Promise<void> {
    const trimmed = this.code.trim().toUpperCase();
    if (!trimmed) return;

    this.loading = true;
    this.error = '';

    const user = await this.auth.user$.pipe(take(1)).toPromise();
    if (!user) {
      this.error = 'Você precisa estar logado.';
      this.loading = false;
      return;
    }

    const result = await this.invite.redeemCode(trimmed, user.uid, user.displayName);

    if (!result.ok) {
      this.error = result.error ?? 'Código inválido.';
      this.loading = false;
      return;
    }

    this.success = true;
    setTimeout(() => this.router.navigate(['/grupos']), 2000);
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    this.router.navigate(['/login']);
  }
}
