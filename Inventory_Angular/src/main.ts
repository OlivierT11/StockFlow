import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// LEARN(A1) : le point d'entrée (angular.json → "browser"). Il démarre Angular avec le composant racine et les
// providers de l'application ; App remplace ensuite l'élément <app-root> de index.html.
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
