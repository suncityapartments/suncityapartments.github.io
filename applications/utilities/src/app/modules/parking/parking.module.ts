import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { DashComponent } from './components/dash/dash.component';
import { LoginComponent } from './components/login/login.component';
import { ParkingRoutingModule } from './parking-routing.module';
import { ParkingComponent } from './parking.component';

@NgModule({
  declarations: [
    ParkingComponent,
    DashComponent,
    LoginComponent,
  ],
  imports: [
    CommonModule,
    ParkingRoutingModule,
  ],
})
export class ParkingModule { }
