// Uso local: npm run push:keys. Nunca salve a chave privada no Git ou no ZIP.
import {createECDH} from 'node:crypto';
const pair=createECDH('prime256v1');pair.generateKeys();
console.log('PUSH_VAPID_PUBLIC_KEY='+pair.getPublicKey().toString('base64url'));
console.log('PUSH_VAPID_PRIVATE_KEY='+pair.getPrivateKey().toString('base64url'));
console.log('PUSH_CONTACT_EMAIL=suporte@SEU-DOMINIO.com');
