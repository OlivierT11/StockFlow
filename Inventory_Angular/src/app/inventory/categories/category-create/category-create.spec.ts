import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryCreate } from './category-create';

describe('CategoryCreate', () => {
  let component: CategoryCreate;

  // componentfixture est un utilitaire fourni par Angular pour tester les composants.
  // Il permet de créer une instance du composant et de gérer son cycle de vie dans un environnement de
  // test.
  let fixture: ComponentFixture<CategoryCreate>;

  // Le bloc beforeEach est exécuté avant chaque test.
  // Il configure le module de test et crée une instance du composant.
  beforeEach(async () => {

    // TestBed est un utilitaire fourni par Angular pour configurer et initialiser l'environnement de test.
    await TestBed.configureTestingModule({
      imports: [CategoryCreate],
    }).compileComponents(); // Compile les composants déclarés dans le module de test.

    fixture = TestBed.createComponent(CategoryCreate);
    component = fixture.componentInstance;
    fixture.detectChanges(); // Déclenche la détection des changements pour initialiser le composant et son template.
  });

  // Le bloc it définit un test individuel.
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
