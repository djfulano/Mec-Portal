require('dotenv').config({path:require('path').join(__dirname,'..','.env'),quiet:true});
const db=require('../db');
async function run(){const c=await db.getConnection();try{
 await c.query("CREATE TABLE IF NOT EXISTS operadora (id TINYINT PRIMARY KEY, nome VARCHAR(160) NOT NULL) ENGINE=InnoDB");
 await c.query("INSERT IGNORE INTO operadora(id,nome) VALUES (1,'MEC Solution')");
 const [cols]=await c.query("SHOW COLUMNS FROM empresas LIKE 'operadora_id'");
 if(!cols.length)await c.query('ALTER TABLE empresas ADD operadora_id TINYINT NOT NULL DEFAULT 1');
 await c.query("INSERT INTO unidades(empresa_id,nome) SELECT e.id,e.nome FROM empresas e WHERE NOT EXISTS(SELECT 1 FROM unidades u WHERE u.empresa_id=e.id)");
 const [orphaned]=await c.query('SELECT m.id,m.empresa_id FROM mikrotiks m LEFT JOIN portais p ON p.id=m.portal_id AND p.empresa_id=m.empresa_id WHERE p.id IS NULL');
 for(const m of orphaned){const config=require('../src/services/portalPolicy').defaults();config.appearance.title='Portal do equipamento';const [p]=await c.query("INSERT INTO portais(empresa_id,nome,slug,tipo,managed,draft_config,draft_updated_at) VALUES (?,? ,?,'custom',1,?,NOW())",[m.empresa_id,'Portal do equipamento '+m.id,'equipamento-'+m.id,JSON.stringify(config)]);await c.query('UPDATE mikrotiks SET portal_id=? WHERE id=?',[p.insertId,m.id]);}
 for(const event of ['INSERT','UPDATE']){const name='mec_device_portal_'+event.toLowerCase();await c.query('DROP TRIGGER IF EXISTS '+name);await c.query(`CREATE TRIGGER ${name} BEFORE ${event} ON mikrotiks FOR EACH ROW BEGIN IF NEW.portal_id IS NULL OR NOT EXISTS(SELECT 1 FROM portais p WHERE p.id=NEW.portal_id AND p.empresa_id=NEW.empresa_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Equipamento exige portal da mesma empresa'; END IF; END`);}
 await c.query('DROP TRIGGER IF EXISTS mec_portal_delete');
 await c.query("CREATE TRIGGER mec_portal_delete BEFORE DELETE ON portais FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM mikrotiks m WHERE m.portal_id=OLD.id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Transfira ou remova os equipamentos antes de excluir o portal'; END IF; END");
 console.log('Organização MEC Solution → empresas → portais → equipamentos aplicada.');
}finally{c.release();await db.end();}}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
