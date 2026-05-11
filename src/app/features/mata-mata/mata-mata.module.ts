import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { MataMataComponent } from './mata-mata.component';

const routes: Routes = [{ path: '', component: MataMataComponent }];

@NgModule({
  declarations: [MataMataComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class MataMataModule {}
