import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class ApprovedGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.auth.user$.pipe(
      take(1),
      map((user) => {
        if (!user) return this.router.createUrlTree(['/login']);
        if (!user.isApproved && !user.isAdmin) {
          return this.router.createUrlTree(['/ativar']);
        }
        return true;
      }),
    );
  }
}
