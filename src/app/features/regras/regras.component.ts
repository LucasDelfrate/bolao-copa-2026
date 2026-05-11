import { Component } from '@angular/core';
import { SCORING_RULES, ScoringSection } from '../../core/config/scoring.config';

@Component({
  selector: 'app-regras',
  templateUrl: './regras.component.html',
  styleUrls: ['./regras.component.css'],
})
export class RegrasComponent {
  sections: ScoringSection[] = SCORING_RULES;
}
