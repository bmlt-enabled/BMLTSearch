import { Component } from '@angular/core';
import { Config } from '../../../app/app.config';

import { IonicPage, NavController, NavParams } from 'ionic-angular';


@Component({
  selector: 'page-do-i-have-the-bmlt',
  templateUrl: 'do-i-have-the-bmlt.html',
})
export class DoIHaveTheBmltComponent {

  constructor(
    private config: Config
  ) {
  }


}
