import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { MonComponent } from './mon-component';

describe('MonComponent', () => {
  let fixture: ComponentFixture<MonComponent>;
  let component: MonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonComponent],

      // Ajoute ici les services ou remplacements nécessaires :
      // providers: [
      //   { provide: MonService, useValue: { charger: vi.fn() } },
      // ],
    }).compileComponents();

    fixture = TestBed.createComponent(MonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('devrait être créé', () => {
    expect(component).toBeTruthy();
  });

  it('devrait afficher son contenu attendu', () => {
    const element: HTMLElement = fixture.nativeElement;

    // Remplace le sélecteur et le texte par ceux de ton template.
    expect(element.querySelector('h1')?.textContent).toContain('Titre attendu');
  });

  it('devrait réagir à une action utilisateur', () => {
    const element: HTMLElement = fixture.nativeElement;
    const bouton = element.querySelector<HTMLButtonElement>('[data-testid="action"]');

    expect(bouton).not.toBeNull();
    bouton!.click();
    fixture.detectChanges();

    // Remplace par le résultat attendu après le clic.
    expect(element.textContent).toContain('Résultat attendu');
  });
});