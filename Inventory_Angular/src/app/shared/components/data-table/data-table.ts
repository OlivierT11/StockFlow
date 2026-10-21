import { Component, Input } from '@angular/core';

export interface DataTableColumn {
  key: string;
  label: string;
}

@Component({
  selector: 'app-data-table',
  standalone: false,
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
})
export class DataTable {
  @Input() columns: DataTableColumn[] = [];
  @Input() rows: object[] = [];

  cellValue(row: object, key: string): string {
    const value = (row as Record<string, unknown>)[key];
    return value === null || value === undefined ? '—' : String(value);
  }
}
