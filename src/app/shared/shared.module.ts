import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatchCardComponent } from './components/match-card/match-card.component';

@NgModule({
  declarations: [MatchCardComponent],
  imports: [CommonModule, FormsModule],
  exports: [MatchCardComponent, CommonModule, FormsModule],
})
export class SharedModule {}
