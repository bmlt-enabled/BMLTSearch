import { NgModule }          from '@angular/core';
import { TidyDelimterPipe }  from './tidy-delimter/tidy-delimter';
import { NoSanitizePipe }    from './no-sanitize/no-sanitize';
import { ParseFloatPipe }    from './parse-float/parse-float';


@NgModule({
	declarations: [
		TidyDelimterPipe,
    NoSanitizePipe,
		ParseFloatPipe
	],
	imports: [],
	exports: [
		TidyDelimterPipe,
    NoSanitizePipe,
		ParseFloatPipe
	]
})
export class PipesModule {}
