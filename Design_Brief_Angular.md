# Brief de design : front Angular de l'application Inventory

Support à fournir à Claude Design pour générer les maquettes du futur front Angular.
Il décrit l'existant (API et écrans React actuels), le modèle et les endpoints cibles
issus du plan backend sur 2 semaines, et la liste des écrans à concevoir.

---

## 1. Contexte

- **Produit** : application de gestion d'inventaire (produits, stocks, entrepôts, mouvements de stock).
- **Backend** : API REST ASP.NET Core (.NET 10), authentification JWT, déployée sur Azure Container Apps.
- **Front actuel** : SPA React minimaliste, en cours de remplacement. Ses écrans servent de point de départ fonctionnel, pas visuel.
- **Front cible** : SPA Angular (standalone components, signals, Angular Material ou équivalent). Client API généré à partir du fichier OpenAPI de l'API.
- **Langue de l'interface** : français. Format monétaire en euros (`12,50 €`), dates au format `JJ/MM/AAAA HH:mm`.
- **Cibles** : desktop en priorité (usage bureau / entrepôt sur PC ou tablette), responsive jusqu'à la tablette. Le mobile n'est pas prioritaire mais la navigation doit rester utilisable.
- **Public** : petite équipe interne (gestionnaire de stock, administrateur). Pas de client final.

## 2. Utilisateurs et rôles

Le rôle est porté par le JWT (claim `role`). Deux rôles :

| Rôle | Peut faire |
|---|---|
| **User** | Se connecter, consulter la liste et le détail des produits, consulter les mouvements, le tableau de bord, les catégories et entrepôts. |
| **Admin** | Tout ce que fait User, plus : créer / modifier / supprimer des produits, catégories et entrepôts ; enregistrer des mouvements de stock ; gérer les utilisateurs (rôle, désactivation). |

Les actions d'écriture doivent être masquées ou désactivées pour un User, et l'API renvoie 403 si elles sont tentées.

## 3. Existant : écrans React actuels et leurs limites

| Écran actuel | Contenu | Limites à corriger dans le nouveau design |
|---|---|---|
| Login (`/login`) | Deux champs sans label (email, mot de passe), bouton Login. | Pas de labels, pas d'état d'erreur lisible, pas de lien d'inscription, pas de "mot de passe oublié". |
| Liste des produits (`/Product_List`) | Liste `<ul>` où chaque ligne est un formulaire éditable inline (nom, prix, stock) avec boutons Détails / Modifier / Supprimer. Pagination numérotée, 10 par page. | Pas de tableau, pas de recherche, pas de tri, pas de filtre, édition inline fragile, confirmation via `window.confirm`, retours via `alert`. |
| Ajouter un produit (`/Product_Add`) | Formulaire Nom / Prix (€) / Quantité, bouton "Ajouter le produit". | Pas de retour visuel après succès, pas d'affichage des erreurs de validation serveur. |
| Détail produit (`/Product_Details/:id`) | Quatre lignes de texte : Id, Nom, Prix, Stock. | Aucune action (modifier, supprimer), aucun historique. |
| Navigation | Barre de boutons : "Ajouter un produit", "Liste des produits", "Logout". | Pas d'indication de la page active, pas d'identité utilisateur, pas de rôle visible. |

## 4. Modèle de données cible

Issu du plan backend. Les champs marqués *(plan)* n'existent pas encore dans l'API.

### Product
| Champ | Type | Règles |
|---|---|---|
| id | int | |
| name | string | requis, max 100 |
| price | decimal | requis, >= 0, 2 décimales |
| stock | int | requis, >= 0 ; modifié uniquement via les mouvements de stock à terme |
| lowStockThreshold *(plan)* | int | >= 0 ; produit "sous seuil" si stock <= seuil |
| categoryId / categoryName *(plan)* | int / string | requis |
| createdAt, createdBy, updatedAt, updatedBy *(plan)* | date / string | audit, lecture seule |
| rowVersion *(plan)* | string | concurrence optimiste, renvoyé au PUT ; un conflit donne un 409 |

### Category *(plan)*
id, name (requis, max 100), nombre de produits.

### Warehouse *(plan)*
id, name (requis, max 100), address (optionnel, max 250).

### StockMovement *(plan)*
| Champ | Type | Règles |
|---|---|---|
| id | int | |
| productId / productName | int / string | requis |
| warehouseId / warehouseName | int / string | requis |
| type | enum | `Entree`, `Sortie`, `Ajustement` (l'enum interne prévoit aussi Purchase, Sale, Return, TransferIn, TransferOut pour plus tard) |
| quantity | int | > 0 ; une Sortie qui rendrait le stock négatif est refusée (400) |
| notes | string | optionnel, max 250 |
| createdAt, userId / userEmail | date / string | lecture seule |

### User
| Champ | Type | Règles |
|---|---|---|
| id | int | |
| email | string | requis, format email |
| username | string | |
| role | string | `User` ou `Admin` |
| isActive *(plan)* | bool | un utilisateur inactif ne peut plus se connecter |

## 5. Contrat API

Base : `{API_URL}/api` (version `/api/v1` prévue en fin de plan). Toutes les routes sauf login / register / refresh exigent `Authorization: Bearer <jwt>`.

### Format des erreurs
Toutes les erreurs suivent `ProblemDetails` (RFC 7807) :
```json
{ "type": "...", "title": "One or more validation errors occurred.", "status": 400,
  "errors": { "Price": ["The field Price must be between 0 and 1.7976931348623157E+308."] } }
```
Codes à gérer dans l'UI : 400 (validation, afficher par champ), 401 (session expirée, tenter le refresh puis rediriger vers login), 403 (action interdite pour le rôle), 404, 409 (conflit de concurrence ou stock négatif), 429 (trop de tentatives de connexion), 500.

### Format des listes paginées
```json
{ "products": [...], "currentPage": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5 }
```

### Endpoints existants
| Méthode | Route | Rôle | Notes |
|---|---|---|---|
| POST | /auth/login | public | body `{ email, password }` ; réponse `{ access_token }` |
| POST | /auth/register | public | body `{ username, email, password }` ; mot de passe >= 8 caractères |
| POST | /auth/logout | connecté | révoque le token |
| GET | /profile | connecté | `{ userId, email, role }`, appelé au chargement pour valider la session |
| GET | /products | connecté | liste complète (éviter dans l'UI, préférer `/paged`) |
| GET | /products/paged?page=N | connecté | 10 par page |
| GET | /products/{id} | connecté | |
| POST | /products | Admin | `{ name, price, stock }` |
| PUT | /products/{id} | Admin | `{ id, name, price, stock }` |
| DELETE | /products/{id} | Admin | |
| GET | /health | public | état API + base |

### Endpoints prévus par le plan
| Méthode | Route | Rôle | Notes |
|---|---|---|---|
| GET | /products/paged | connecté | nouveaux paramètres : `search`, `categoryId`, `minPrice`, `maxPrice`, `lowStockOnly`, `sortBy` (name, price, stock, updatedAt), `sortDir` (asc, desc), `pageSize` (max 100) |
| GET | /products/low-stock | connecté | produits sous seuil |
| GET | /products/{id}/movements?page=N | connecté | historique d'un produit |
| POST | /auth/refresh | public | `{ refreshToken }`, rotation à chaque appel ; access token valide 15 min |
| GET | /users?page=N | Admin | |
| PUT | /users/{id}/role | Admin | `{ role }` |
| PUT | /users/{id}/disable | Admin | |
| GET / POST / PUT / DELETE | /categories, /categories/{id} | lecture : connecté, écriture : Admin | |
| GET / POST / PUT / DELETE | /warehouses, /warehouses/{id} | lecture : connecté, écriture : Admin | |
| POST | /stock/movements | Admin | `{ productId, warehouseId, type, quantity, notes }` |
| GET | /stock/movements?warehouseId=&from=&to=&page= | connecté | |
| GET | /dashboard | connecté | `{ productCount, totalStockValue, lowStockCount, recentMovements[] }` |

## 6. Écrans à concevoir

Par ordre de priorité. Chaque écran doit prévoir ses états : chargement (skeleton), vide, erreur, et la variante User / Admin.

### 6.1 Connexion
- Champs email et mot de passe avec labels, afficher / masquer le mot de passe.
- Message d'erreur sous le formulaire ("Email ou mot de passe incorrect"), état "trop de tentatives" (429).
- Lien vers l'inscription. Indicateur de chargement sur le bouton.

### 6.2 Inscription
- Nom d'utilisateur, email, mot de passe (>= 8), confirmation.
- Un nouveau compte a le rôle User.

### 6.3 Shell applicatif (layout commun)
- Barre latérale ou barre supérieure avec : Tableau de bord, Produits, Mouvements, Catégories, Entrepôts, Utilisateurs (Admin seulement).
- En-tête : nom de l'application, email de l'utilisateur, badge de rôle, bouton Déconnexion.
- Zone de toasts (succès / erreur) en haut à droite.
- Bandeau "session expirée, reconnectez-vous" si le refresh échoue.

### 6.4 Tableau de bord
- Quatre tuiles : nombre de produits, valeur totale du stock, produits sous seuil (cliquable vers la liste filtrée), mouvements du jour.
- Liste des derniers mouvements (date, produit, type, quantité, utilisateur).
- Encart "produits sous seuil" avec les 5 premiers.

### 6.5 Liste des produits
- Tableau : Nom, Catégorie, Prix, Stock (avec badge rouge si sous seuil), Dernière modification, Actions.
- Barre d'outils : recherche texte (debounce), filtre catégorie, fourchette de prix, case "stock bas uniquement", bouton "Ajouter un produit" (Admin).
- Tri par colonne, choix du nombre par page (10 / 25 / 50 / 100), pagination avec total.
- Actions par ligne : Voir, Modifier (Admin), Supprimer (Admin, avec boîte de confirmation).
- Filtres et page reflétés dans l'URL (lien partageable).

### 6.6 Détail d'un produit
- En-tête : nom, catégorie, badge stock bas, boutons Modifier / Supprimer / Nouveau mouvement (Admin).
- Bloc informations : prix, stock, seuil, créé le / par, modifié le / par.
- Onglet ou section "Historique des mouvements" : tableau paginé (date, type, quantité signée, entrepôt, utilisateur, notes).

### 6.7 Formulaire produit (création et édition, même composant)
- Champs : nom, catégorie (select), prix, stock initial (création uniquement, en édition le stock n'est modifiable que par mouvement), seuil de stock bas.
- Validation en direct et affichage des erreurs renvoyées par l'API par champ.
- En édition : gestion du 409 ("Ce produit a été modifié par quelqu'un d'autre, recharger ?").

### 6.8 Nouveau mouvement de stock
- Formulaire en panneau latéral ou modale : produit (recherche), entrepôt, type (Entrée / Sortie / Ajustement), quantité, notes.
- Aperçu du stock avant / après. Message bloquant si le stock résultant est négatif.

### 6.9 Journal des mouvements
- Tableau paginé de tous les mouvements, filtres : entrepôt, type, période (de / à), produit.
- Export CSV à prévoir visuellement (hors scope backend pour l'instant, bouton désactivé acceptable).

### 6.10 Catégories et entrepôts
- Deux écrans simples : tableau + formulaire en modale. Suppression bloquée si des produits sont rattachés (message explicatif).

### 6.11 Utilisateurs (Admin)
- Tableau : email, nom d'utilisateur, rôle (select inline), statut actif / inactif (toggle avec confirmation).
- Un admin ne peut pas se désactiver ni se rétrograder lui-même.

## 7. Composants transverses à définir

- Tableau de données paginé et triable, avec état vide illustré et skeleton.
- Barre de filtres repliable.
- Badge de stock : normal / sous seuil / rupture (stock = 0).
- Badge de type de mouvement : Entrée (vert), Sortie (orange), Ajustement (bleu).
- Boîte de confirmation destructive (titre, conséquence, bouton rouge).
- Toast de succès / erreur avec action "Annuler" quand c'est pertinent.
- Champ monétaire et champ quantité avec validation.
- Page 403 "Accès refusé" et page 404.

## 8. Contraintes de design

- Interface en français, ton neutre et professionnel.
- Densité moyenne : les tableaux doivent afficher 10 à 25 lignes sans scroll excessif sur un écran 1366 px de large.
- Accessibilité : contraste AA, navigation clavier dans les tableaux et formulaires, labels explicites, focus visible.
- Mode sombre souhaitable mais optionnel.
- Palette libre, mais une couleur primaire sobre (bleu ou vert) et des couleurs sémantiques réservées aux états (succès, alerte, erreur).
- Pas de dépendance à des illustrations externes ; les icônes doivent provenir d'une bibliothèque standard (Material Icons ou équivalent).

## 9. Hors scope

Fournisseurs, multi-entrepôt par produit (InventoryItem), import / export CSV fonctionnel, notifications temps réel, application mobile native.

---

## 10. Prompt de démarrage pour Claude Design

À coller en premier message, en joignant ce fichier :

> Conçois l'interface d'une application web de gestion d'inventaire en Angular, à partir du brief joint. L'interface est en français, destinée à une petite équipe interne, desktop en priorité et responsive jusqu'à la tablette. Deux rôles : User (lecture) et Admin (écriture et administration). Commence par le shell applicatif (navigation, en-tête, toasts), puis le tableau de bord, puis la liste des produits avec sa barre de filtres et son tableau paginé, puis le détail produit avec l'historique des mouvements et le panneau "Nouveau mouvement". Pour chaque écran, montre les états chargement, vide, erreur et la variante User / Admin. Utilise les champs, règles de validation et codes d'erreur décrits dans le brief ; ne pas inventer de données qui n'y figurent pas. Propose un système de design léger (couleurs, typographie, espacements, composants transverses du chapitre 7) réutilisable dans Angular Material.
