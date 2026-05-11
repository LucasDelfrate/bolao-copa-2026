import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { RegrasComponent } from './regras.component';

const routes: Routes = [{ path: '', component: RegrasComponent }];

@NgModule({
  declarations: [RegrasComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class RegrasModule {}
