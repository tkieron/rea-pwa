import { Routes } from '@angular/router';
import { Map } from './components/map/map';
import { anonymousOnlyMatchGuard, authRequiredMatchGuard } from './core/guards/auth.guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: '',
    canMatch: [anonymousOnlyMatchGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        loadComponent: () => import('./pages/register/register').then((m) => m.RegisterPage),
      },
    ],
  },
  {
    path: '',
    canMatch: [authRequiredMatchGuard],
    children: [
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
        path: 'pet-profile',
        loadComponent: () => import('./pages/pet-profile/pet-profile').then((m) => m.PetProfilePage),
      },
      {
        path: 'pet-edit',
        loadComponent: () => import('./pages/pet-edit/pet-edit').then((m) => m.PetEditPage),
      },
      {
        path: 'map',
        component: Map,
      },
    ],
  },
  {
    path: '**',
    canMatch: [authRequiredMatchGuard],
    redirectTo: 'main-view-map',
  },
];
