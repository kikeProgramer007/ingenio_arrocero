import { Routes } from '@angular/router';
import { Documentation } from './documentation/documentation';
import { Crud } from './crud/crud';
import { Empty } from './empty/empty';
import { LoginComponent } from './login/login.component'; 

export default [
    { path: 'documentation', component: Documentation },
    { path: 'crud', component: Crud },
    { path: 'empty', component: Empty },
    { path: 'login',component: LoginComponent},
    { path: '**', redirectTo: '/notfound' }
 
] as Routes;
