import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ImportComponent } from './components/import/import.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'dashboard',
    component: DashboardComponent
  },
  {
    path: 'import',
    component: ImportComponent
  },
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  }
];
