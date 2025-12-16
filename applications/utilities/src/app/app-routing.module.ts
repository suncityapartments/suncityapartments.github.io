import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        redirectTo: 'staff',
        pathMatch: 'full',
      },
      {
        path: 'water',
        loadChildren: () => import('./modules/water/water.module').then(m => m.WaterModule),
      },
      {
        path: 'parking',
        loadChildren: () => import('./modules/parking/parking.module').then(m => m.ParkingModule),
      },
      {
        path: 'staff',
        loadChildren: () => import('./modules/staff/staff.module').then(m => m.StaffModule),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule],
})
export class AppRoutingModule { }
