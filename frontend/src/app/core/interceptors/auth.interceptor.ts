import { HttpInterceptorFn } from '@angular/common/http';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { APP_CONSTANTS } from '../constants/app-constants';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token) {
        return next(req);
    }

    return next(
        req.clone({
            setHeaders: {
                [APP_CONSTANTS.TOKEN_HEADER]: `${APP_CONSTANTS.TOKEN_PREFIX} ${token}`
            }
        })
    );
};
