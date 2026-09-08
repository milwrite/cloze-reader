import {mkdirSync,rmSync,copyFileSync,cpSync} from 'node:fs';
rmSync('dist',{recursive:true,force:true});mkdirSync('dist',{recursive:true});
for(const file of ['index.html','favicon.png','favicon.svg','apple-touch-icon.png','icon.png','icon-192.png','icon-512.png','site.webmanifest'])copyFileSync(file,'dist/'+file);
cpSync('src','dist/assets',{recursive:true});
