import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { QRComponent, QRPrintPage, StaffHomePage } from './pages';
import { StaffRoutingModule } from './staff-routing.module';

@NgModule({
  declarations: [
    QRPrintPage,
    QRComponent,
    StaffHomePage,
  ],
  imports: [
    CommonModule,
    StaffRoutingModule,
  ],
})
export class StaffModule { }
