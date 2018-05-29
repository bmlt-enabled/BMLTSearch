import { Component } from '@angular/core';
import { Config } from '../../../app/app.config';

@Component({
  selector: 'page-contact',
  templateUrl: 'contact.html'
})
export class ContactComponent {

  sourceCodeLink    : string = "https://github.com/paulnagle/BMLTSearch";
  sourceBugs        : string = "https://github.com/paulnagle/BMLTSearch/issues";
  bmltLink          : string = "https://bmlt.magshare.net/";
  
  constructor( private config: Config) {

  }

  public openLink(url) {
    window.open(url , '_system');
  }

}
