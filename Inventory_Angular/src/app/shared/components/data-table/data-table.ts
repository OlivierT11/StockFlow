import { Component, Signal, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';


export interface DataTableColumn {
  key: string;
  label: string;
}

@Component({
  selector: 'app-data-table',
  imports: [DatePipe],
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
})
export class DataTable {
  columns = input<DataTableColumn[]>([]);
  rows = input<object[]>([]);

  // Ensure rows are always an array for *ngFor safety
  safeRows: Signal<object[]> = computed(() => {
    const rowsValue = this.rows();
    return Array.isArray(rowsValue) ? rowsValue : [];
  });

  // Returns the string representation of the value for a given row and column key.
  cellValue(row: object, key: string): string {
    const value = (row as Record<string, unknown>)[key];
    return value === null || value === undefined ? '—' : String(value);
  }
}

