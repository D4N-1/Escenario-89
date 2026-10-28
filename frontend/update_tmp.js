const fs = require('fs');
let c = fs.readFileSync('frontend/src/app/admin/layout/layout.html', 'utf8');
const target = '    <div class="estado">';
const addition = `    <div class="karaoke-switch-card">
      <div class="karaoke-switch-info">
        <span class="karaoke-switch-title">Intro Karaoke</span>
        <small class="karaoke-switch-sub" [class.on]="player.karaokeIntroHabilitado()">
          {{ player.karaokeIntroHabilitado() ? 'Activado' : 'Desactivado' }}
        </small>
      </div>
      <button type="button"
              class="karaoke-toggle"
              [class.active]="player.karaokeIntroHabilitado()"
              (click)="player.toggleKaraokeIntroHabilitado()"
              role="switch"
              [attr.aria-checked]="player.karaokeIntroHabilitado()"
              title="Activar o desactivar presentación de karaoke">
        <span class="karaoke-toggle-thumb"></span>
      </button>
    </div>

    <div class="estado">`;
c = c.replace(target, addition);
fs.writeFileSync('frontend/src/app/admin/layout/layout.html', c, 'utf8');
console.log('Successfully updated layout.html');

