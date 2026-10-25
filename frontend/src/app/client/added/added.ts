import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClientHeader } from '../../shared/client-header/client-header';
import { VideoCard } from '../../shared/video-card/video-card';
import { Icon } from '../../shared/icon/icon';
import { ClientFooter } from '../../shared/client-footer/client-footer';
import { AppState } from '../../core/app-state';

@Component({
  selector: 'app-added',
  imports: [RouterLink, ClientHeader, VideoCard, Icon, ClientFooter],
  templateUrl: './added.html',
  styleUrl: '../home/home.css',
})
export class Added {
  state = inject(AppState);
}