import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardApi } from './dashboard-api';
import { DashboardSummary } from './dashboard.model';

@Component({
  selector: 'app-dashboard-page',
  standalone: false,
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  private readonly dashboardApi = inject(DashboardApi);
  readonly summary$: Observable<DashboardSummary> = this.dashboardApi.getSummary();
}
