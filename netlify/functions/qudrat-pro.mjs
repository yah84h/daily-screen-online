import {fetchQudratLeaderboard} from '../../local-test/qudrat-pro.mjs';
export async function handler(event){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
 if(event.httpMethod!=='GET')return{statusCode:405,headers,body:JSON.stringify({error:'Method not allowed'})};
 try{return{statusCode:200,headers,body:JSON.stringify(await fetchQudratLeaderboard())};}
 catch(error){return{statusCode:503,headers,body:JSON.stringify({error:error.code==='NOT_CONFIGURED'?'NOT_CONFIGURED':'UPSTREAM_UNAVAILABLE'})};}
}
