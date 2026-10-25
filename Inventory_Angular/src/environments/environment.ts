// LEARN(A1) : configuration fixée au build. `ng build` (production) utilise ce fichier ; `ng serve` utilise la
// configuration development, qui le remplace par environment.development.ts ("fileReplacements" dans angular.json).
export const environment = {
  /** Origin of Inventory_Api. Empty: the API is served from the same origin as the app. */
  apiUrl: '',
};
