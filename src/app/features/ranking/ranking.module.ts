import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { RankingComponent } from './ranking.component';

const routes: Routes = [{ path: '', component: RankingComponent }];

@NgModule({
  declarations: [RankingComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class RankingModule {}
