import { NgModule } from '@angular/core';
import { TidyDelimterPipe } from './tidy-delimter/tidy-delimter';
import { NoSanitizePipe } from './no-sanitize/no-sanitize';
@NgModule({
	declarations: [
		TidyDelimterPipe,
    NoSanitizePipe
	],
	imports: [],
	exports: [
		TidyDelimterPipe,
    NoSanitizePipe
	]
})
export class PipesModule {}
