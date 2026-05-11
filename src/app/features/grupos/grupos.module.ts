import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { GruposComponent } from './grupos.component';

const routes: Routes = [{ path: '', component: GruposComponent }];

@NgModule({
  declarations: [GruposComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class GruposModule {}
