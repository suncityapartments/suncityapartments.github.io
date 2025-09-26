import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { MeteredPage } from './pages/metered/metered.page';
import { SQFTPage } from './pages/sqft/sqft.page';
import { WaterPage } from './water.page';

const routes: Routes = [{
  path: '',
  component: WaterPage,
  children: [
    {
      path: '',
      redirectTo: 'metered',
      pathMatch: 'full',
    },
    {
      path: 'metered',
      component: MeteredPage,
    },
    {
      path: 'sqft',
      component: SQFTPage,
    },
  ],
}];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WaterRoutingModule { }
