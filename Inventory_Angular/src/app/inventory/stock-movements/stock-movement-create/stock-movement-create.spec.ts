import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StockMovementCreate } from './stock-movement-create';

describe('StockMovementCreate', () => {
  let component: StockMovementCreate;
  let fixture: ComponentFixture<StockMovementCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StockMovementCreate],
    }).compileComponents();

    fixture = TestBed.createComponent(StockMovementCreate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
