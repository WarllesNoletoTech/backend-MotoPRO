/** Classificação dos ganhos por origem, sem declarar que houve integração quando o registro foi manual. */
export type PlatformKey='rappidex'|'ifood'|'uber'|'99'|'private'|'other'|'manual';
export const PLATFORMS:ReadonlyArray<PlatformKey>=['rappidex','ifood','uber','99','private','other','manual'];
export function platformOf(row:{source?:string|null;provider?:string|null;platform?:string|null}):PlatformKey{
 if(row.source==='private'||row.provider==='private')return 'private';
 if(row.source==='integration'&&row.provider==='rappidex')return 'rappidex';
 if(row.platform==='rappidex'||row.platform==='ifood'||row.platform==='uber'||row.platform==='99'||row.platform==='other')return row.platform;
 return 'manual';
}
export const PLATFORM_LABELS:Record<PlatformKey,string>={
 rappidex:'Rappidex',ifood:'iFood',uber:'Uber', '99':'99',private:'Particulares',other:'Outras plataformas',manual:'Sem plataforma informada'
};
export type Achievement={id:string;title:string;description:string;progress:number;target:number;unlocked:boolean};
export function calculateAchievements(stats:{entries:number;distinctDays:number;privatePaid:number;hasGoal:boolean;hasMoto:boolean;hasPlan:boolean;hasRappidex:boolean}):Achievement[]{
 const define=(id:string,title:string,description:string,progress:number,target=1):Achievement=>({id,title,description,progress:Math.min(target,Math.max(0,progress)),target,unlocked:progress>=target});
 return [
  define('first-entry','Primeiro registro','Cadastre seu primeiro lançamento financeiro.',stats.entries),
  define('organization-25','Organização em dia','Cadastre 25 lançamentos financeiros.',stats.entries,25),
  define('days-7','Registro consistente','Registre informações em 7 dias diferentes (últimos 365 dias).',stats.distinctDays,7),
  define('goal-set','Meta definida','Defina uma meta financeira semanal ou mensal.',Number(stats.hasGoal)),
  define('moto-set','Minha moto','Cadastre sua motocicleta no aplicativo.',Number(stats.hasMoto)),
  define('maintenance-set','Revisões organizadas','Configure um lembrete de manutenção.',Number(stats.hasPlan)),
  define('private-first','Primeira entrega particular','Receba uma entrega particular no MotoPRO.',stats.privatePaid),
  define('private-10','Clientes próprios','Receba 10 entregas particulares.',stats.privatePaid,10),
  define('rappidex-set','Integração conectada','Conecte sua conta ao Rappidex.',Number(stats.hasRappidex))
 ];
}
