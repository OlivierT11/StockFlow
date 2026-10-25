import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiDatePipe } from '../../shared/inventory/api-date-pipe';
import { ErrorBanner } from '../../shared/ui/error-banner';
import { Icon } from '../../shared/ui/icon';
import { PageHead } from '../../shared/ui/page-head';
import { DashboardApi } from './dashboard-api';
import { StockChart } from './stock-chart';

/**
 * Home page: key figures, low stock products, latest movements and a chart.
 *
 * LEARN(A2) : un composant standalone liste dans `imports` chaque composant, directive et pipe utilisé par son
 * template. Les exercices ci-dessous ont besoin de EmptyState, MovementTypeBadge et SignedQtyPipe : ajoute-les
 * ici quand tu t'en sers (sinon le compilateur signale un élément ou un pipe inconnu, et il prévient aussi des
 * imports inutilisés).
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, CurrencyPipe, DecimalPipe, ApiDatePipe, PageHead, ErrorBanner, Icon, StockChart],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  private readonly api = inject(DashboardApi);

  protected readonly dashboard = rxResource({ stream: () => this.api.get() });
}
