const path = require('path');
require('dotenv').config({path: path.join(__dirname, '.env'), quiet: true});
const fs = require('fs');
const crypto = require('crypto');
const {spawnSync} = require('child_process');
const mysql = require('mysql2/promise');
async function run() {
 const db = await mysql.createConnection({host:process.env.DB_HOST, user:process.env.DB_USER, password:process.env.DB_PASSWORD, database:process.env.DB_NAME});
 try {
  await db.execute('CREATE TABLE IF NOT EXISTS deployment_migrations (name VARCHAR(255) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  for (const name of fs.readdirSync(path.join(__dirname,'migrations')).filter(n=>/^\d{3}_.*\.js$/.test(n)).sort()) {
   const file=path.join(__dirname,'migrations',name);
   const checksum=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
   const [[done]]=await db.execute('SELECT checksum FROM deployment_migrations WHERE name=?',[name]);
   if(done) { if(done.checksum!==checksum) throw new Error(`Migration ja aplicada foi modificada: ${name}. Crie uma nova migration.`); continue; }
   const child=spawnSync(process.execPath,[file],{cwd:__dirname,stdio:'inherit',timeout:300000});
   if(child.error || child.status!==0) throw new Error(`Migration falhou: ${name}`);
   await db.execute('INSERT INTO deployment_migrations (name,checksum) VALUES (?,?)',[name,checksum]);
  }
 } finally { await db.end(); }
}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
