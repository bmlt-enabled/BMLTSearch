import { NgModule }             from '@angular/core';
import { CommonModule }         from '@angular/common';
import { SharedModule }         from '../../app/shared/shared.module';
import { PipesModule }          from '../../pipes/pipes.module';
import { ModalComponent }       from './modal-component/modal.component';

@NgModule({
	declarations: [
		ModalComponent
	],
	imports: [
		CommonModule,
		SharedModule,
		PipesModule
	],
	exports: [
		ModalComponent
	],
  entryComponents:[
  	ModalComponent
  ]
})
export class ModalModule {}
