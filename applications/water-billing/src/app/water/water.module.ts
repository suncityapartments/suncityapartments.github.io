import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WaterRoutingModule } from './water-routing.module';
import { WaterComponent } from './water.component';
import { FormsModule } from '@angular/forms';


@NgModule({
  declarations: [
    WaterComponent
  ],
  imports: [
    CommonModule,
    WaterRoutingModule,
    FormsModule,
  ]
})
export class WaterModule { }
