import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MeteredPage } from './pages/metered/metered.page';
import { SQFTPage } from './pages/sqft/sqft.page';
import { WaterRoutingModule } from './water-routing.module';
import { WaterPage } from './water.page';

@NgModule({
  declarations: [
    WaterPage,
    MeteredPage,
    SQFTPage,
  ],
  imports: [
    CommonModule,
    WaterRoutingModule,
    FormsModule,
    ReactiveFormsModule,
  ],
})
export class WaterModule { }
