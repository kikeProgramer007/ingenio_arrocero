import { Component, inject } from '@angular/core';
import { Router } from "@angular/router";
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';
import { AppFloatingConfigurator } from '../../layout/component/app.floatingconfigurator';
import { AuthService } from '../../core/services/auth.service';
import { APP_ROUTES } from '../../core/constants/app-routes';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [ButtonModule, CheckboxModule, InputTextModule, PasswordModule, FormsModule, RouterModule, RippleModule, AppFloatingConfigurator],
    templateUrl: './login.component.html'
})

export class LoginComponent {
    toggleForm = false;
    loading = false;
    errorMensaje = '';
    loginObj: any = {
        username: "",
        password: ""
    }
    router = inject(Router);
    private authService = inject(AuthService);

    onLogin() {
        this.errorMensaje = '';
        this.loading = true;
        this.authService.login(this.loginObj.username, this.loginObj.password).subscribe({
            next: () => {
                this.loading = false;
                this.router.navigateByUrl(APP_ROUTES.dashboard);
            },
            error: (error) => {
                this.loading = false;
                this.errorMensaje = error?.error?.mensaje || 'No se pudo iniciar sesión';
            }
        });
    }
}
