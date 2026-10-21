import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { AdminLayout } from './layout/admin-layout';
import { CategoriesPage } from './inventory/categories/categories.page';
import { DashboardPage } from './inventory/dashboard/dashboard.page';
import { ProductsPage } from './inventory/products/products.page';
import { StockMovementsPage } from './inventory/stock-movements/stock-movements.page';
import { WarehousesPage } from './inventory/warehouses/warehouses.page';
import { DataTable } from './shared/components/data-table/data-table';
import { MetricCard } from './shared/components/metric-card/metric-card';
import { DateFormatPipe } from './shared/pipes/date-format.pipe';
import { LoginPage } from './auth/login/login.page';
import { JwtInterceptor } from './auth/jwt.interceptor';

@NgModule({
  declarations: [
    App,
    AdminLayout,
    DashboardPage,
    ProductsPage,
    StockMovementsPage,
    CategoriesPage,
    WarehousesPage,
    DataTable,
    MetricCard,
    DateFormatPipe,
    LoginPage,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true
    }
  ],
  bootstrap: [App]
})
export class AppModule { }
