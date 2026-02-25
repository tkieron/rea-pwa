import { Routes } from '@angular/router';
import { Map } from './components/map/map';
import { anonymousOnlyMatchGuard, authRequiredMatchGuard } from './core/guards/auth.guards';

export const routes: Routes = [
  {
    path: '',
    canMatch: [authRequiredMatchGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'main-view-map',
      },
      {
        path: 'connect-device',
        loadComponent: () =>
          import('./pages/connect-device/connect-device').then((m) => m.ConnectDevicePage),
      },
      {
        path: 'main-view-map',
        loadComponent: () =>
          import('./pages/main-view-map/main-view-map').then((m) => m.MainViewMapPage),
      },
      {
        path: 'pets',
        loadComponent: () => import('./pages/pets-list/pets-list').then((m) => m.PetsListPage),
      },
      {
        path: 'pet-profile',
        redirectTo: 'pets',
        pathMatch: 'full',
      },
      {
        path: 'pet-profile/:petId',
        loadComponent: () => import('./pages/pet-profile/pet-profile').then((m) => m.PetProfilePage),
      },
      {
        path: 'pet-edit',
        redirectTo: 'main-view-map',
        pathMatch: 'full',
      },
      {
        path: 'pet-add',
        loadComponent: () => import('./pages/pet-edit/pet-edit').then((m) => m.PetEditPage),
      },
      {
        path: 'pet-edit/:petId',
        loadComponent: () => import('./pages/pet-edit/pet-edit').then((m) => m.PetEditPage),
      },
      {
        path: 'map',
        component: Map,
      },
      {
        path: '**',
        redirectTo: 'main-view-map',
      },
    ],
  },
  {
    path: '',
    canMatch: [anonymousOnlyMatchGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'login',
      },
      {
        path: 'login',
        loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        loadComponent: () => import('./pages/register/register').then((m) => m.RegisterPage),
      },
      {
        path: '**',
        redirectTo: 'login',
      },
    ],
  },
];
