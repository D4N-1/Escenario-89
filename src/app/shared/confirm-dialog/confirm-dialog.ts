import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../icon/icon';

/** Popup móvil "¿Pedir canción?" */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Icon, RouterLink],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialog {}
