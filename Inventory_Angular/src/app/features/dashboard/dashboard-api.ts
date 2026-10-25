import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api-base-url';
import { Dashboard } from '../../core/api/api-models';

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Counters, low stock products and latest movements (cached 60 s by the API, refreshed by every movement). */
  get(): Observable<Dashboard> {
    return this.http.get<Dashboard>(`${this.baseUrl}/api/v1/dashboard`);
  }
}
