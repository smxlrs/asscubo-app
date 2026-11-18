import { fetchWithDeadline, NetworkError, requireSuccessfulResponse } from './network';

export const CLASSROOM_ORIGIN = 'https://unibo.prod.up.cineca.it';
const AULE_PATH = '/api/Aule/getAulePerCalendarioPubblico';
const IMPEGNI_PATH = '/api/Impegni/getImpegniCalendarioPubblico';
export type ClassroomPayload = { from: string; to: string };
export type ClassroomData = { classrooms: unknown[]; bookings: unknown[] };
export class ClassroomBrowserRequired extends Error {}

export function classroomRequests({ from, to }: ClassroomPayload, classroomIds?: string[]) {
  const calendar = { linkCalendarioId: '5f632ffc78b5fe001d1ea638', clienteId: '5ad08435b6ca5357dbac609e' };
  return [
    { path: AULE_PATH, body: { ...calendar, ricercaPerTesto: '', limit: 100 } },
    { path: IMPEGNI_PATH, body: { ...calendar, mostraImpegniAnnullati: true,
      mostraIndisponibilitaTotali: false, pianificazioneTemplate: false, dataInizio: from, dataFine: to,
      ...(classroomIds ? { auleIds: classroomIds } : {}) } },
  ];
}

export async function fetchClassroomData(payload: ClassroomPayload): Promise<ClassroomData> {
  const results: unknown[][] = [];
  for (let index = 0; index < 2; index++) {
    if (index === 1 && !results[0].length) return { classrooms: [], bookings: [] };
    const ids = results[0]?.map(room => (room as { id?: unknown } | null)?.id);
    if (ids?.some(id => typeof id !== 'string' || !id)) throw new NetworkError('data', 'Invalid classroom identifiers');
    const request = classroomRequests(payload, ids as string[] | undefined)[index];
    const response = await fetchWithDeadline(CLASSROOM_ORIGIN + request.path, {
      method: 'POST', headers: { 'Content-Type': 'application/json;charset=UTF-8' }, body: JSON.stringify(request.body),
    });
    // AWS WAF returns a successful HTTP 202 with an empty/HTML challenge, not JSON.
    // The official page must finish its normal browser verification first.
    if (response.status === 202 || response.headers.get('x-amzn-waf-action') === 'challenge') {
      throw new ClassroomBrowserRequired('Official website verification required');
    }
    requireSuccessfulResponse(response);
    const data = await response.json();
    if (!Array.isArray(data)) throw new NetworkError('data', 'Invalid classroom data');
    results.push(data);
  }
  return { classrooms: results[0], bookings: results[1] };
}

export function isClassroomOrigin(url: string): boolean {
  try { const value = new URL(url); return value.origin === CLASSROOM_ORIGIN && !value.username && !value.password; }
  catch { return false; }
}

/** Runs only inside the official website; no tokens or private app data are sent. */
export function classroomBrowserScript(id: number, payload: ClassroomPayload): string {
  return `(function(){
    if(location.origin!==${JSON.stringify(CLASSROOM_ORIGIN)} || window.__boxueClassroomRequest===${id}) return;
    window.__boxueClassroomRequest=${id};
    var requests=${JSON.stringify(classroomRequests(payload))};
    function send(value){window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({id:${id}},value)));}
    async function read(){
      var result=[];
      for(var i=0;i<requests.length;i++){
        var request=requests[i];
        if(i===1){
          if(!result[0].length) return [[],[]];
          var ids=result[0].map(function(room){return room && room.id;});
          if(ids.some(function(id){return typeof id!=='string'||!id;})) throw {invalid:true};
          request.body.auleIds=ids;
        }
        var response=await fetch(request.path,{method:'POST',credentials:'same-origin',
          headers:{'Content-Type':'application/json;charset=UTF-8'},body:JSON.stringify(request.body)});
        if(response.status===202 || response.headers.get('x-amzn-waf-action')==='challenge') throw {challenge:true};
        if(!response.ok) throw {status:response.status};
        var data=await response.json();
        if(!Array.isArray(data)) throw {invalid:true};
        // Timetable records include large unrelated resource trees. Only transfer fields used by the tool.
        if(i===1) data=data.map(function(booking){
          if(!booking || typeof booking!=='object') throw {invalid:true};
          return {id:booking.id,dataInizio:booking.dataInizio,dataFine:booking.dataFine,nome:booking.nome,
            aule:booking.aule && booking.aule.map(function(room){return {id:room.id,codice:room.codice,descrizione:room.descrizione};}),
            tipoAttivita:booking.tipoAttivita && {descrizione:booking.tipoAttivita.descrizione}};
        });
        result.push(data);
      }
      return result;
    }
    function load(){read().then(function(data){send({classrooms:data[0],bookings:data[1]});}).catch(function(error){
      if(error && error.challenge){
        // Let the official page complete verification without interrupting it with a reload.
        setTimeout(load,1500);
      } else send({error:true,status:error && error.status || 0,invalid:!!(error && (error.invalid || error.name==='SyntaxError'))});
    });} load();
  })(); true;`;
}
