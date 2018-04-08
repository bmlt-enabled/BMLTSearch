import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../app/shared/shared.module';

import { DoIHaveTheBmltComponent} from './do-i-have-the-bmlt-component/do-i-have-the-bmlt.component';

@NgModule({
  declarations: [
    DoIHaveTheBmltComponent,
  ],
  imports: [
    CommonModule,
  	SharedModule
    ],
    exports: [
      DoIHaveTheBmltComponent
    ],
    entryComponents:[
      DoIHaveTheBmltComponent
    ]
})
export class DoIHaveTheBmltModule {}
