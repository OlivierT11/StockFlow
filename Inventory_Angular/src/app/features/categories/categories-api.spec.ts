import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../core/api/api-base-url';
import { CategoriesApi } from './categories-api';

// LEARN(C4) : un test de service. provideHttpClientTesting() remplace le réseau : le test vérifie quelle requête
// le service a envoyée, puis y répond avec flush().
describe('CategoriesApi', () => {
  let api: CategoriesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '' }],
    });
    api = TestBed.inject(CategoriesApi);
    http = TestBed.inject(HttpTestingController);
  });

  // Fails the test if the service sent a request the test did not expect.
  afterEach(() => http.verify());

  it('lists the categories', () => {
    let result: unknown;
    api.list().subscribe((categories) => (result = categories));

    http.expectOne({ method: 'GET', url: '/api/v1/categories' }).flush([{ id: 1, name: 'Outillage' }]);

    expect(result).toEqual([{ id: 1, name: 'Outillage' }]);
  });

  it('sends the new name on update', () => {
    api.update(3, 'Visserie').subscribe();

    const req = http.expectOne({ method: 'PUT', url: '/api/v1/categories/3' });
    expect(req.request.body).toEqual({ name: 'Visserie' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  // TODO(C4) : écris le même genre de test pour ProductsApi.paged() : vérifie que les champs de la requête se
  // retrouvent dans les paramètres d'URL (req.request.params.get('askedPage')) et que les filtres vides sont omis.
});
