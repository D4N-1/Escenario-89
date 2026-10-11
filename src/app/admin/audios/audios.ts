import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { AUDIOS } from '../../mock-data';

@Component({ selector: 'app-audios', imports: [Icon, RouterLink], templateUrl: './audios.html', styleUrl: '../anuncios/anuncios.css' })
export class Audios { audios = AUDIOS; }
