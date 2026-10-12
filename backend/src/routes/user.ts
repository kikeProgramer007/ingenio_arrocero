import { Router } from 'express';
import { actualizarUsuario, crearUsuario, listarPerfiles, listarUsuarios, loginUser } from '../controllers/user';
import validateToken from './validate-token';

const router = Router();

router.post('/login', loginUser);
router.get('/perfiles', validateToken, listarPerfiles);
router.get('/', validateToken, listarUsuarios);
router.post('/', validateToken, crearUsuario);
router.put('/:id', validateToken, actualizarUsuario);

export default router;
