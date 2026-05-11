import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminGuard } from './core/guards/admin.guard';
import { ApprovedGuard } from './core/guards/approved.guard';
import { AuthGuard } from './core/guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'grupos', pathMatch: 'full' },
  {
    path: 'login',
    loadChildren: () =>
      import('./features/login/login.module').then((m) => m.LoginModule),
  },
  {
    path: 'ativar',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./features/ativar/ativar.module').then((m) => m.AtivarModule),
  },
  {
    path: 'admin',
    canActivate: [AuthGuard, AdminGuard],
    loadChildren: () =>
      import('./features/admin/admin.module').then((m) => m.AdminModule),
  },
  {
    path: 'grupos',
    canActivate: [AuthGuard, ApprovedGuard],
    loadChildren: () =>
      import('./features/grupos/grupos.module').then((m) => m.GruposModule),
  },
  {
    path: 'mata-mata',
    canActivate: [AuthGuard, ApprovedGuard],
    loadChildren: () =>
      import('./features/mata-mata/mata-mata.module').then(
        (m) => m.MataMataModule,
      ),
  },
  {
    path: 'ranking',
    canActivate: [AuthGuard, ApprovedGuard],
    loadChildren: () =>
      import('./features/ranking/ranking.module').then((m) => m.RankingModule),
  },
  {
    path: 'regras',
    canActivate: [AuthGuard, ApprovedGuard],
    loadChildren: () =>
      import('./features/regras/regras.module').then((m) => m.RegrasModule),
  },
  { path: '**', redirectTo: 'grupos' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
