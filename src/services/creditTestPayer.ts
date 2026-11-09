import {HttpError} from '../utils/http.js';

/**
 * Comprador de teste exclusivo do administrador, isolado da identidade real dos motoboys.
 * Não é permitido ativar a substituição em ambiente de cobrança Premium real.
 * Remova TODAS as variáveis MP_CREDIT_TEST_* ao sair da homologação.
 */
export function resolveCreditPayerEmail(
  user: {email:string;role:string},
  settings: {testMode?:string;testPayerEmail?:string;enforcePremium?:string}
):string {
  const override=(settings.testPayerEmail||'').trim().toLowerCase();
  if(settings.testMode!=='true'){
    // Falha segura quando sobrar uma configuração de homologação no Heroku.
    if(override)throw new HttpError(503,'Remova MP_CREDIT_TEST_PAYER_EMAIL antes de usar cobranças reais');
    return user.email;
  }
  if(settings.enforcePremium==='true')
    throw new HttpError(503,'Desative MP_ENFORCE_PREMIUM durante o teste administrativo de cartão');
  if(user.role!=='admin')
    throw new HttpError(403,'Modo de teste de cartão reservado ao administrador');
  if(!/^[a-z0-9._%+\-]+@testuser\.com$/.test(override))
    throw new HttpError(503,'Defina MP_CREDIT_TEST_PAYER_EMAIL com o e-mail da conta COMPRADORA de teste do Mercado Pago (@testuser.com)');
  return override;
}
