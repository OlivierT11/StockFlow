import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-metric-card',
  standalone: false,
  templateUrl: './metric-card.html',
  styleUrl: './metric-card.css',
})
export class MetricCard {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = '';
  @Input() detail = '';
}
