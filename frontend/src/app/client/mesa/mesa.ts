import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientHeader } from '../../shared/client-header/client-header';
import { AppState } from '../../core/app-state';
import { SessionService } from '../../core/session.service';

/**
 * Entrada del cliente por QR:
 *   /mesa/:codigo  -> valida el código de la mesa en el backend y lo lleva al inicio.
 *   /sin-mesa      -> el cliente llegó sin escanear el QR.
 */
@Component({
    selector: 'app-mesa',
    imports: [ClientHeader],
    templateUrl: './mesa.html',
    styleUrl: './mesa.css',
})
export class Mesa {
    private session = inject(SessionService);
    private router = inject(Router);
    private state = inject(AppState);

    codigo = inject(ActivatedRoute).snapshot.paramMap.get('codigo')?.trim() ?? '';
    cargando = signal(!!this.codigo);
    error = signal('');

    constructor() {
        if (this.codigo) this.entrar();
    }

    async entrar() {
        this.cargando.set(true);
        this.error.set('');

        // Si en este teléfono había otra mesa, se limpian sus canciones
        if (this.session.codigoMesa() && this.session.codigoMesa() !== this.codigo) {
            this.state.misCanciones.set([]);
            this.state.mesa.set(0);
        }

        try {
            await this.session.entrarMesa(this.codigo);
            this.router.navigate(['/'], { replaceUrl: true });
        } catch (e) {
            this.error.set(e instanceof Error ? e.message : 'No pudimos entrar a tu mesa. Intenta de nuevo.');
            this.cargando.set(false);
        }
    }
}