import { Component, input } from '@angular/core';

export interface DataTableColumn {
  key: string;
  label: string;
}

@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
})
export class DataTable {
  columns = input<DataTableColumn[]>([]);
  rows = input<object[]>([]);

  // Returns the string representation of the value for a given row and column key.
  cellValue(row: object, key: string): string {
    const value = (row as Record<string, unknown>)[key];
    return value === null || value === undefined ? '—' : String(value);
  }
}
