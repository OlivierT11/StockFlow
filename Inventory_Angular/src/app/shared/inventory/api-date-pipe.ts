import { formatDate } from '@angular/common';
import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';

/**
 * `{{ m.date | apiDate }}` → "25/10/2026 14:05" (local time), `{{ m.date | apiDate: 'dd/MM' }}` → "25/10".
 *
 * The API stores UTC dates but sometimes serializes them without the trailing "Z"; the built-in `date`
 * pipe would read those as local time. This pipe adds the "Z", then formats like `date`.
 *
 * LEARN(A3) : un pipe personnalisé qui réutilise le formatage du framework (formatDate) et la locale de
 * l'application (LOCALE_ID, réglée sur fr-FR dans app.config.ts).
 */
@Pipe({ name: 'apiDate' })
export class ApiDatePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(value: string | null | undefined, format = 'dd/MM/yyyy HH:mm'): string {
    if (!value) return '';
    const utc = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
    return formatDate(utc, format, this.locale);
  }
}
