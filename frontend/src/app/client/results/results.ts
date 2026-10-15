import { Component, inject, signal } from '@angular/core';
import { Icon } from '../../shared/icon/icon';
import { ClientHeader } from '../../shared/client-header/client-header';
import { VideoCard } from '../../shared/video-card/video-card';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AppState } from '../../core/app-state';
import { Video } from '../../core/models';

@Component({
  selector: 'app-results',
  imports: [Icon, ClientHeader, VideoCard, ConfirmDialog],
  templateUrl: './results.html',
  styleUrl: '../home/home.css',
})
export class Results {
  state = inject(AppState);
  seleccion = signal<Video | null>(null);
}