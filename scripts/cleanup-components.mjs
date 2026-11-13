import fs from 'node:fs';
for(const f of fs.readdirSync('src/pages').filter(f=>f.endsWith('.vue'))){const p='src/pages/'+f;let s=fs.readFileSync(p,'utf8');for(const n of ['BaseButton','SlidingTabs'])if(!s.includes('<'+n))s=s.replace(new RegExp('import[^\\n]*'+n+'[^\\n]*\\n'),'');fs.writeFileSync(p,s);}
