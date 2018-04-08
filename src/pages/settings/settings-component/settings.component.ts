import { Component } from '@angular/core';
import { Storage } from '@ionic/storage';
import { TranslateService } from '@ngx-translate/core';

@Component({
    templateUrl: 'settings.html'
})
export class SettingsComponent {

	language: string;
  searchRange: number;

	constructor(
		private storage: Storage ,
		private translate: TranslateService
		){

    }

	ngOnInit() {
	    this.storage.get('language')
	    .then(value => {
	        if(value) {
	        	this.language = value;
	        } else {
	        	this.language = 'en';
	        }
	    });

      this.storage.get('searchRange')
	    .then(value => {
	        if(value) {
	        	this.searchRange = value;
	        } else {
	        	this.searchRange = 10;
	        }
	    });

	}

	selectLanguage() {
		this.storage.set('language', this.language);
    this.translate.setDefaultLang(this.language);
    this.translate.use(this.language);
	}

  searchRangeChange() {
    this.storage.set('searchRange', this.searchRange);
  }
}
