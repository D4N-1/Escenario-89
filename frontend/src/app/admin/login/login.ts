import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../core/session.service';

@Component({ selector: 'app-login', templateUrl: './login.html', styleUrl: './login.css' })
export class Login {
  private session = inject(SessionService);
  private router = inject(Router);

  error = signal('');
  enviando = signal(false);

  constructor() {
    if (this.session.esAdmin()) this.router.navigate(['/admin']);
  }

  async entrar(clave: string) {
    if (!clave) {
      this.error.set('Escribe tu contraseña');
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    try {
      await this.session.entrarAdmin(clave);
      this.router.navigate(['/admin']);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      this.enviando.set(false);
    }
  }
}