import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardApi } from './dashboard-api';
import { DashboardSummary } from './dashboard.model';
import { AsyncPipe } from '@angular/common';
import { MetricCard } from '../../shared/components/metric-card/metric-card';

@Component({
  selector: 'app-dashboard-page',
  imports: [AsyncPipe, MetricCard],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  private readonly dashboardApi = inject(DashboardApi);
  readonly summary$: Observable<DashboardSummary> = this.dashboardApi.getSummary();
}
