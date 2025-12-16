import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { QRPrintPage, StaffHomePage } from './pages';

const routes: Routes = [{
  path: '',
  component: StaffHomePage,
  children: [
    {
      path: '',
      redirectTo: 'qr-print',
      pathMatch: 'full',
    },
    {
      path: 'qr-print',
      component: QRPrintPage,
    },
  ],
}];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StaffRoutingModule { }
