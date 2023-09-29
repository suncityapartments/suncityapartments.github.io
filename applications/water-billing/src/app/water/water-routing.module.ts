import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WaterComponent } from './water.component';
import { MeteredComponent } from './pages/metered/metered.component';

const routes: Routes = [{ 
  path: '', 
  component: WaterComponent,
  children: [
    {
      path: '',
      redirectTo: 'metered',
      pathMatch: 'full',
    },
    {
      path: 'metered',
      component: MeteredComponent
    }
  ]
}];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class WaterRoutingModule { }
