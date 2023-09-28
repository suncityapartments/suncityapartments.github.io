import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WaterRoutingModule } from './water-routing.module';
import { WaterComponent } from './water.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';


@NgModule({
  declarations: [
    WaterComponent
  ],
  imports: [
    CommonModule,
    WaterRoutingModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class WaterModule { }
