import { Component, Input } from '@angular/core';
import { AppUser } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent {
  @Input() user!: AppUser;
  menuOpen = false;

  constructor(private auth: AuthService) {}

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    window.location.href = '/login';
  }
}
