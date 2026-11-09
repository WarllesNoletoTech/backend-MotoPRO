import {User} from '../models/User.js';
import {uid} from './auth.js';
import {nameParts} from '../utils/name.js';
import {asyncRoute,HttpError} from '../utils/http.js';
/** Impede uso de integrações e criação de Pix com cadastro incompleto, inclusive via API. */
export const requireCompleteName=asyncRoute(async(req,_res,next)=>{
 const user=(await User.findById(uid(req)).select('name').lean()) as {name?:string}|null;
 if(!user)throw new HttpError(401,'Conta não encontrada');
 if(!nameParts(user.name||'').complete)throw new HttpError(428,'Complete seu nome e sobrenome em Minha conta para continuar.');
 next();
});
