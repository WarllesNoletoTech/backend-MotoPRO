import {Router} from 'express';
import {Entry} from '../models/Entry.js';
import {Goal} from '../models/Goal.js';
import {Motorcycle} from '../models/Motorcycle.js';
import {MaintenancePlan} from '../models/MaintenancePlan.js';
import {IntegrationConnection} from '../models/IntegrationConnection.js';
import {RewardCampaign} from '../models/RewardCampaign.js';
import {uid} from '../services/auth.js';
import {asyncRoute} from '../utils/http.js';
import {addDays,dateInTimezone} from '../utils/dates.js';
import {calculateAchievements} from '../services/phase3.js';

export const achievementsRouter=Router();
achievementsRouter.get('/',asyncRoute(async(req,res)=>{
 const userId=uid(req);
 const lastYear=addDays(dateInTimezone('America/Belem'),-364);
 const [entries,days,privatePaid,goal,moto,plan,rappidex,campaigns]=await Promise.all([
  Entry.countDocuments({userId}),
  Entry.distinct('occurredOn',{userId,occurredOn:{$gte:lastYear}}),
  Entry.countDocuments({userId,source:'private',provider:'private'}),
  Goal.findOne({userId}).select('weeklyTargetCents monthlyTargetCents').lean(),
  Motorcycle.exists({userId}),
  MaintenancePlan.exists({userId,enabled:true}),
  IntegrationConnection.exists({userId,provider:'rappidex'}),
  RewardCampaign.find({status:'published',$and:[{$or:[{startsAt:{$exists:false}},{startsAt:{$lte:new Date()}}]},{$or:[{endsAt:{$exists:false}},{endsAt:{$gte:new Date()}}]}]}).select('title description reward objectiveCriteria startsAt endsAt').limit(20).lean()
 ]);
 const items=calculateAchievements({entries,distinctDays:days.length,privatePaid,
  hasGoal:!!(goal?.weeklyTargetCents||goal?.monthlyTargetCents),hasMoto:!!moto,hasPlan:!!plan,hasRappidex:!!rappidex});
 res.setHeader('Cache-Control','private, no-store');
 res.json({achievements:items,unlocked:items.filter(a=>a.unlocked).length,total:items.length,
  campaigns:campaigns.map(x=>({id:String(x._id),title:x.title,description:x.description,reward:x.reward,
   criteria:x.objectiveCriteria,startsAt:x.startsAt||null,endsAt:x.endsAt||null})),
  note:'Conquistas são reconhecimentos pessoais e não garantem pagamento. Benefícios externos dependem do regulamento da campanha e de avaliação administrativa.'});
}));
