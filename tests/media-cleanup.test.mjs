import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {cleanupMedia} from '../local-test/media-cleanup.mjs';
test('cleanup preserves nested references, active uploads and symlinked data',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'native-cleanup-'));
 try {
  const root=path.join(dir,'media');fs.mkdirSync(path.join(root,'content'),{recursive:true});fs.mkdirSync(path.join(root,'backgrounds'));
  for(const file of ['keep.png','orphan.png','pending.png.part-uuid'])fs.writeFileSync(path.join(root,'content',file),'test');
  fs.writeFileSync(path.join(root,'backgrounds','my image.jpg'),'photo');fs.writeFileSync(path.join(dir,'outside.txt'),'untouched');fs.symlinkSync(path.join(dir,'outside.txt'),path.join(root,'content','outside-link'));
  const db={screens:[{template:{recognition:{students:[{photo:'/storage/v1/object/public/media/content/keep.png'}]},centerSlideshow:{images:[{url:'http://192.168.1.1:8080/storage/v1/object/public/media/backgrounds/my%20image.jpg'}]}}}]};
  const staff={active:true,permissions:{admin:true}};
  const preview=cleanupMedia(db,root,staff);assert.equal(preview.count,1);assert(fs.existsSync(path.join(root,'content','orphan.png')));
  const result=cleanupMedia(db,root,staff,true);assert.equal(result.removed,1);assert(fs.existsSync(path.join(root,'content','keep.png')));assert(fs.existsSync(path.join(root,'content','pending.png.part-uuid')));assert(fs.existsSync(path.join(dir,'outside.txt')));
  assert.throws(()=>cleanupMedia(db,root,{active:true,permissions:{daily:true}},true),/المسؤول/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('cleanup rechecks references after a preview',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'native-cleanup-'));
 try{fs.mkdirSync(path.join(dir,'content'));fs.writeFileSync(path.join(dir,'content','new.png'),'test');const db={posts:[]},staff={active:true,permissions:{admin:true}};assert.equal(cleanupMedia(db,dir,staff).count,1);db.posts.push({content:{image:'/storage/v1/object/public/media/content/new.png'}});assert.equal(cleanupMedia(db,dir,staff,true).removed,0);assert(fs.existsSync(path.join(dir,'content','new.png')));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
