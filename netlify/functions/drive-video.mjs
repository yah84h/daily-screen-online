import {driveVideoResponse} from '../../local-test/drive-video.mjs';
export default async(request)=>{try{return await driveVideoResponse(request);}catch(error){return Response.json({error:error.code||'DRIVE_UNAVAILABLE'},{status:error.status||502,headers:{'Cache-Control':'no-store'}});}};
