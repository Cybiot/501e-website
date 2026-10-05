import { Routes } from '@angular/router';
import { AdminLayout } from './admin-layout';

export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', loadComponent: () => import('./dashboard.page').then((m) => m.DashboardPage) },
      { path: 'medailles', loadComponent: () => import('./awards.page').then((m) => m.AwardsPage) },
      { path: 'medailles/catalogue', loadComponent: () => import('./catalog.page').then((m) => m.CatalogPage) },
      { path: 'grades', loadComponent: () => import('./ranks.page').then((m) => m.RanksPage) },
      { path: 'moderation', loadComponent: () => import('./moderation.page').then((m) => m.ModerationPage) },
      { path: 'logs', loadComponent: () => import('./logs.page').then((m) => m.LogsPage) },
      { path: 'parametres', loadComponent: () => import('./settings.page').then((m) => m.SettingsPage) },
    ],
  },
];
