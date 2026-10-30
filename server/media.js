import multer from 'multer';
import sharp from 'sharp';
import { uid } from './auth.js';
import { fail } from './modules.js';
export const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:4*1024*1024,files:3,fields:5,fieldSize:64*1024}});
export const backupUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:64*1024*1024,files:1,fields:2}});
export async function imageFiles(files=[]){const result=[];for(const f of files){let bytes;try{const image=sharp(f.buffer,{limitInputPixels:24000000,animated:false});const meta=await image.metadata();if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1)fail(422,'仅支持非动画JPG、PNG和WebP');bytes=await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:86}).toBuffer();}catch(e){if(e.status)throw e;fail(422,'图片无法解码或尺寸过大，请重新选择JPG、PNG或WebP');}result.push({id:uid('IMG'),name:f.originalname.replace(/[\\/\u0000-\u001f]/g,'').slice(0,160),mime:'image/webp',bytes});}return result;}
