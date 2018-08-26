import { Component }            from '@angular/core';
import { Storage }              from '@ionic/storage';
import { TranslateService }     from '@ngx-translate/core';

@Component({
    templateUrl: 'settings.html'
})
export class SettingsComponent {

	language        : string;
  theme           : string;
  searchRange     : number;
  timeDisplay     : string;

	constructor(
		private storage     : Storage ,
		private translate   : TranslateService
		) {

    }

	ngOnInit() {
	    this.storage.get('language')
	    .then(langValue => {
	        if(langValue) {
	        	this.language = langValue;
	        } else {
	        	this.language = 'en';
	        }
	    });

      this.storage.get('searchRange')
      .then(searchValue => {
          if(searchValue) {
            this.searchRange = searchValue;
          } else {
            this.searchRange = 25;
          }
      });

      this.storage.get('timeDisplay')
      .then(timeDisplay => {
          if(timeDisplay) {
            this.timeDisplay = timeDisplay;
          } else {
            this.timeDisplay = "24hr";
          }
      });
	}

	selectLanguage() {
		this.storage.set('language', this.language);
    this.translate.setDefaultLang(this.language);
    this.translate.use(this.language);
	}

  selectTheme() {
    this.storage.set('theme', this.theme);
  }

  selectSearchRange() {
    this.storage.set('searchRange', this.searchRange);
  }

  selectTimeDisplay() {
    this.storage.set('timeDisplay', this.timeDisplay);
  }

}
