import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { AppUser } from './core/models';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  user$: Observable<AppUser | null>;

  constructor(auth: AuthService) {
    this.user$ = auth.user$;
  }
}
