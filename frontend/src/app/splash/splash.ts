import { Component } from '@angular/core';
@Component({
  selector: 'app-splash',
  template: `<div class="s"><img src="logohd.png" alt="Escenario 89"></div>`,
  styles: `.s{min-height:100vh;background:#000;display:grid;place-items:center} img{width:min(260px,50vw)}`,
})
export class Splash {}
