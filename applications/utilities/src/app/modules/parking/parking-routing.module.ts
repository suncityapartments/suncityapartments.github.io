import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashComponent } from './components/dash/dash.component';
import { LoginComponent } from './components/login/login.component';
import { AuthGuard } from './guards/auth.guard';
import { ParkingComponent } from './parking.component';

const routes: Routes = [
  {
    path: '',
    component: ParkingComponent,
    children: [
      {
        path: '',
        redirectTo: 'dash',
        pathMatch: 'full',
      },
      {
        path: 'login',
        component: LoginComponent,
      },
      {
        path: 'dash',
        canActivate: [AuthGuard],
        component: DashComponent,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ParkingRoutingModule { }
