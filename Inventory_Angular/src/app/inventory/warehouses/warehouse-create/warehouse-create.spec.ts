import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WarehouseCreate } from './warehouse-create';

describe('WarehouseCreate', () => {
  let component: WarehouseCreate;
  let fixture: ComponentFixture<WarehouseCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WarehouseCreate],
    }).compileComponents();

    fixture = TestBed.createComponent(WarehouseCreate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
