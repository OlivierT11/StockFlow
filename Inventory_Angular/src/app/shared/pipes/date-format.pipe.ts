import { Pipe, PipeTransform } from '@angular/core';

// Pipe that formats a date value into a human-readable string in French locale.
@Pipe({
  name: 'dateFormat',
})
export class DateFormatPipe implements PipeTransform {
  transform(value: Date | string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }
}
