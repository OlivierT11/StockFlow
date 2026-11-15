import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CategoriesPage } from './categories';

describe('CategoriesPage', () => {
  let fixture: ComponentFixture<CategoriesPage>;
  let component: CategoriesPage;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoriesPage],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoriesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('devrait être créé', () => {
    expect(component).toBeTruthy();
  });

});
