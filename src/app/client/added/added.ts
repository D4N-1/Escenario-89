import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClientHeader } from '../../shared/client-header/client-header';
import { VideoCard } from '../../shared/video-card/video-card';
import { AppState } from '../../core/app-state';

@Component({
  selector: 'app-added',
  imports: [RouterLink, ClientHeader, VideoCard],
  templateUrl: './added.html',
  styleUrl: '../home/home.css',
})
export class Added {
  state = inject(AppState);
}