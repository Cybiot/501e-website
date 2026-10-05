import { Routes } from '@angular/router';
import { adminGuard, memberGuard } from './core/guards';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage) },
  { path: 'communaute', loadComponent: () => import('./pages/community/community.page').then((m) => m.CommunityPage) },
  {
    path: 'communaute/regiment',
    loadComponent: () => import('./pages/community/regiment.page').then((m) => m.RegimentPage),
  },
  { path: 'compagnies', loadComponent: () => import('./pages/community/companies.page').then((m) => m.CompaniesPage) },
  {
    path: 'compagnies/:slug',
    loadComponent: () => import('./pages/community/company.page').then((m) => m.CompanyPage),
  },
  // Ancienne adresse des fiches compagnie (avant la page dédiée).
  { path: 'communaute/compagnies/:slug', redirectTo: ({ params }) => `/compagnies/${params['slug']}` },
  { path: 'membres', loadComponent: () => import('./pages/members/members.page').then((m) => m.MembersPage) },
  { path: 'membres/:id', loadComponent: () => import('./pages/members/member.page').then((m) => m.MemberPage) },
  { path: 'rejoindre', loadComponent: () => import('./pages/join/join.page').then((m) => m.JoinPage) },
  { path: 'connexion', loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage) },
  {
    path: 'carte',
    canActivate: [memberGuard],
    loadComponent: () => import('./pages/map/map.page').then((m) => m.MapPage),
  },
  {
    path: 'profil',
    canActivate: [memberGuard],
    loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () => import('./pages/admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: 'confidentialite',
    loadComponent: () => import('./pages/legal/legal.page').then((m) => m.LegalPage),
    data: { doc: 'confidentialite' },
  },
  {
    path: 'cookies',
    loadComponent: () => import('./pages/legal/legal.page').then((m) => m.LegalPage),
    data: { doc: 'cookies' },
  },
  { path: 'erreur', loadComponent: () => import('./pages/errors/error.page').then((m) => m.ErrorPage) },
  { path: '**', loadComponent: () => import('./pages/errors/not-found.page').then((m) => m.NotFoundPage) },
];
