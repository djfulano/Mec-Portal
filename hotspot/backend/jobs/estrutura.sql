/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_empresas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `admin_id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `role` enum('owner','manager','operator') COLLATE utf8mb4_unicode_ci DEFAULT 'operator',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_empresa` (`admin_id`,`empresa_id`),
  KEY `empresa_id` (`empresa_id`),
  CONSTRAINT `admin_empresas_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE CASCADE,
  CONSTRAINT `admin_empresas_ibfk_2` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_grupos` (
  `admin_id` int NOT NULL,
  `grupo_id` int NOT NULL,
  PRIMARY KEY (`admin_id`,`grupo_id`),
  KEY `grupo_id` (`grupo_id`),
  CONSTRAINT `admin_grupos_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE CASCADE,
  CONSTRAINT `admin_grupos_ibfk_2` FOREIGN KEY (`grupo_id`) REFERENCES `grupos_permissao` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` int DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `nome` varchar(255) DEFAULT NULL,
  `role` enum('super_admin','owner','manager','operator') DEFAULT 'operator',
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_admins_empresa` (`empresa_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `applied_updates` (
  `id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descricao` text COLLATE utf8mb4_unicode_ci,
  `aplicado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campanha_itens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `campanha_id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `tipo` enum('imagem','video') NOT NULL,
  `ordem` int DEFAULT '0',
  `arquivo_url` varchar(500) NOT NULL,
  `duracao_segundos` int DEFAULT '5',
  `titulo` varchar(200) DEFAULT NULL,
  `link_destino` varchar(500) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_itens_campanha_ordem` (`campanha_id`,`ordem`),
  KEY `idx_itens_empresa` (`empresa_id`),
  CONSTRAINT `fk_itens_campanha` FOREIGN KEY (`campanha_id`) REFERENCES `campanhas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_itens_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campanhas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` int NOT NULL,
  `nome` varchar(150) NOT NULL,
  `descricao` text,
  `ativo` tinyint(1) DEFAULT '1',
  `views` int DEFAULT '0',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_campanhas_empresa` (`empresa_id`),
  CONSTRAINT `fk_campanhas_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `config_mercadopago` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` int DEFAULT NULL,
  `public_key` varchar(255) DEFAULT NULL,
  `access_token` text,
  `client_id` varchar(255) DEFAULT NULL,
  `client_secret` text,
  `webhook_secret` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mp_empresa` (`empresa_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `connection_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` int NOT NULL,
  `username` varchar(64) NOT NULL,
  `cpf` varchar(14) DEFAULT NULL,
  `mac` varchar(50) NOT NULL,
  `ip_atribuido` varchar(15) NOT NULL,
  `nas_ip` varchar(15) NOT NULL,
  `inicio_conexao` datetime NOT NULL,
  `fim_conexao` datetime DEFAULT NULL,
  `bytes_entrada` bigint DEFAULT '0',
  `bytes_saida` bigint DEFAULT '0',
  `duracao_segundos` int DEFAULT '0',
  `motivo_desconexao` varchar(32) DEFAULT NULL,
  `auth_result` varchar(32) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_empresa_id` (`empresa_id`),
  KEY `idx_cpf` (`cpf`),
  KEY `idx_mac` (`mac`),
  KEY `idx_ip_atribuido` (`ip_atribuido`),
  KEY `idx_periodo` (`inicio_conexao`,`fim_conexao`),
  KEY `idx_username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=1441 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `connection_logs_sync` (
  `id` int NOT NULL AUTO_INCREMENT,
  `last_synced_radacctid` bigint DEFAULT '0',
  `synced_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `efi_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` int DEFAULT NULL,
  `client_id` varchar(255) NOT NULL,
  `client_secret` varchar(255) NOT NULL,
  `chave_pix` varchar(255) NOT NULL,
  `ambiente` enum('sandbox','producao') DEFAULT 'sandbox',
  `certificado_nome` varchar(255) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_efi_empresa` (`empresa_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `empresa_configs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` int NOT NULL,
  `config_type` enum('mercadopago','efi','whatsapp') NOT NULL,
  `config_json` json NOT NULL,
  `ativo` tinyint(1) DEFAULT '1',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_empresa_tipo` (`empresa_id`,`config_type`),
  CONSTRAINT `fk_empresa_configs` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `empresa_vpn_peers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` int NOT NULL,
  `wg_client_id` varchar(100) NOT NULL,
  `nome` varchar(100) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vpn_empresa` (`empresa_id`),
  KEY `idx_vpn_client` (`wg_client_id`),
  CONSTRAINT `fk_vpn_peers_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `empresas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `cnpj` varchar(20) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `logo_url` varchar(500) DEFAULT NULL,
  `ativo` tinyint(1) DEFAULT '1',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_slug` (`slug`),
  KEY `idx_ativo` (`ativo`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `file_snapshots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `md5_hash` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `snapshot_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_file_path` (`file_path`)
) ENGINE=InnoDB AUTO_INCREMENT=2142 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grupo_permissoes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `grupo_id` int NOT NULL,
  `modulo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ver` tinyint(1) DEFAULT '1',
  `criar` tinyint(1) DEFAULT '0',
  `editar` tinyint(1) DEFAULT '0',
  `excluir` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_grupo_modulo` (`grupo_id`,`modulo`),
  CONSTRAINT `grupo_permissoes_ibfk_1` FOREIGN KEY (`grupo_id`) REFERENCES `grupos_permissao` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=71 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grupos_permissao` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descricao` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` int NOT NULL,
  `nome` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cpf` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mac` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('novo','contactado','convertido','descartado') COLLATE utf8mb4_unicode_ci DEFAULT 'novo',
  `origem` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'portal',
  `observacoes` text COLLATE utf8mb4_unicode_ci,
  `lgpd_aceite` tinyint(1) DEFAULT '0',
  `lgpd_aceite_em` timestamp NULL DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `empresa_id` (`empresa_id`),
  CONSTRAINT `leads_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lgpd_logins_backup` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` int DEFAULT NULL,
  `cpf` varchar(14) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `aceite` tinyint(1) NOT NULL DEFAULT '0',
  `mac` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `nome` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lgpd_empresa` (`empresa_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mikrotiks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` int NOT NULL DEFAULT '1',
  `nome` varchar(100) NOT NULL,
  `ip` varchar(45) NOT NULL,
  `usuario` varchar(100) NOT NULL,
  `senha` varchar(255) NOT NULL,
  `porta` int DEFAULT '8728',
  `status` varchar(20) DEFAULT 'Offline',
  `usuarios_ativos` int DEFAULT '0',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `end_hotspot` varchar(255) DEFAULT NULL,
  `portal_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mikrotik_empresa` (`empresa_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nasname` varchar(128) NOT NULL,
  `shortname` varchar(32) DEFAULT NULL,
  `type` varchar(30) DEFAULT 'other',
  `ports` int DEFAULT NULL,
  `secret` varchar(60) NOT NULL DEFAULT 'secret',
  `server` varchar(64) DEFAULT NULL,
  `community` varchar(50) DEFAULT NULL,
  `description` varchar(200) DEFAULT 'RADIUS Client',
  `empresa_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `nasname` (`nasname`),
  KEY `idx_nas_empresa` (`empresa_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nasreload` (
  `nasipaddress` varchar(15) NOT NULL,
  `reloadtime` datetime NOT NULL,
  PRIMARY KEY (`nasipaddress`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pagamentos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` int DEFAULT NULL,
  `cliente_id` int DEFAULT NULL,
  `plano_id` int NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `nome_plano` varchar(255) DEFAULT NULL,
  `valor` int NOT NULL,
  `status` varchar(50) DEFAULT NULL,
  `metodo_pagamento` varchar(20) DEFAULT 'pix',
  `mp_pagamento_id` bigint DEFAULT NULL,
  `criado_em` datetime DEFAULT CURRENT_TIMESTAMP,
  `expira_em` datetime DEFAULT NULL,
  `atualizado_em` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `mac` varchar(20) DEFAULT NULL,
  `cpf` varchar(20) DEFAULT NULL,
  `IP` varchar(20) DEFAULT NULL,
  `observacao` text,
  `portal_id` int DEFAULT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `trial_liberado_em` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pagamentos_empresa` (`empresa_id`),
  KEY `idx_pagamentos_cpf_trial` (`cpf`,`trial_liberado_em`)
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `planos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` int NOT NULL DEFAULT '1',
  `nome` varchar(100) NOT NULL,
  `descricao` text,
  `valor` decimal(10,2) NOT NULL,
  `duracao_minutos` int NOT NULL,
  `velocidade_down` varchar(20) NOT NULL,
  `velocidade_up` varchar(20) NOT NULL,
  `mikrotik_id` int DEFAULT NULL,
  `ativo` tinyint(1) DEFAULT '1',
  `address_pool` varchar(50) DEFAULT 'default-dhcp',
  `shared_users` int DEFAULT '10',
  PRIMARY KEY (`id`),
  KEY `mikrotik_id` (`mikrotik_id`),
  KEY `idx_planos_empresa` (`empresa_id`),
  CONSTRAINT `planos_ibfk_1` FOREIGN KEY (`mikrotik_id`) REFERENCES `mikrotiks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `time_minutes` int NOT NULL,
  `download` int DEFAULT NULL,
  `upload` int DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `portais` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'basico',
  `url_redirect` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `html_content` longtext COLLATE utf8mb4_unicode_ci,
  `descricao` text COLLATE utf8mb4_unicode_ci,
  `ativo` tinyint(1) DEFAULT '1',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `empresa_id` int DEFAULT NULL,
  `template_id` int DEFAULT NULL,
  `custom_css` text COLLATE utf8mb4_unicode_ci,
  `logo_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cor_primaria` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT '#3B82F6',
  `cor_fundo` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT '#0f111a',
  `campos_cadastro` json DEFAULT NULL,
  `mostrar_planos` tinyint(1) DEFAULT '0',
  `mostrar_lgpd` tinyint(1) DEFAULT '1',
  `configuracoes` text COLLATE utf8mb4_unicode_ci,
  `campanha_ativa_id` int DEFAULT NULL,
  `whatsapp_enabled` tinyint(1) DEFAULT '0',
  `whatsapp_template` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_empresa_slug` (`empresa_id`,`slug`),
  KEY `idx_portais_empresa` (`empresa_id`),
  KEY `fk_portal_campanha` (`campanha_ativa_id`),
  CONSTRAINT `fk_portal_campanha` FOREIGN KEY (`campanha_ativa_id`) REFERENCES `campanhas` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `portal_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `descricao` text,
  `thumbnail_url` varchar(500) DEFAULT NULL,
  `html_template` longtext NOT NULL,
  `css_template` text,
  `tipo` varchar(50) DEFAULT 'basico',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `radacct` (
  `radacctid` bigint NOT NULL AUTO_INCREMENT,
  `acctsessionid` varchar(64) NOT NULL DEFAULT '',
  `acctuniqueid` varchar(32) NOT NULL DEFAULT '',
  `username` varchar(64) NOT NULL DEFAULT '',
  `realm` varchar(64) DEFAULT '',
  `nasipaddress` varchar(15) NOT NULL DEFAULT '',
  `nasportid` varchar(32) DEFAULT NULL,
  `nasporttype` varchar(32) DEFAULT NULL,
  `acctstarttime` datetime DEFAULT NULL,
  `acctupdatetime` datetime DEFAULT NULL,
  `acctstoptime` datetime DEFAULT NULL,
  `acctinterval` int DEFAULT NULL,
  `acctsessiontime` int unsigned DEFAULT NULL,
  `acctauthentic` varchar(32) DEFAULT NULL,
  `connectinfo_start` varchar(128) DEFAULT NULL,
  `connectinfo_stop` varchar(128) DEFAULT NULL,
  `acctinputoctets` bigint DEFAULT NULL,
  `acctoutputoctets` bigint DEFAULT NULL,
  `calledstationid` varchar(50) NOT NULL DEFAULT '',
  `callingstationid` varchar(50) NOT NULL DEFAULT '',
  `acctterminatecause` varchar(32) NOT NULL DEFAULT '',
  `servicetype` varchar(32) DEFAULT NULL,
  `framedprotocol` varchar(32) DEFAULT NULL,
  `framedipaddress` varchar(15) NOT NULL DEFAULT '',
  `framedipv6address` varchar(45) NOT NULL DEFAULT '',
  `framedipv6prefix` varchar(45) NOT NULL DEFAULT '',
  `framedinterfaceid` varchar(44) NOT NULL DEFAULT '',
  `delegatedipv6prefix` varchar(45) NOT NULL DEFAULT '',
  `class` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`radacctid`),
  UNIQUE KEY `acctuniqueid` (`acctuniqueid`),
  KEY `username` (`username`),
  KEY `framedipaddress` (`framedipaddress`),
  KEY `framedipv6address` (`framedipv6address`),
  KEY `framedipv6prefix` (`framedipv6prefix`),
  KEY `framedinterfaceid` (`framedinterfaceid`),
  KEY `delegatedipv6prefix` (`delegatedipv6prefix`),
  KEY `acctsessionid` (`acctsessionid`),
  KEY `acctsessiontime` (`acctsessiontime`),
  KEY `acctstarttime` (`acctstarttime`),
  KEY `acctinterval` (`acctinterval`),
  KEY `acctstoptime` (`acctstoptime`),
  KEY `nasipaddress` (`nasipaddress`),
  KEY `class` (`class`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `radcheck` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(64) NOT NULL,
  `attribute` varchar(64) NOT NULL DEFAULT 'Cleartext-Password',
  `op` char(2) NOT NULL DEFAULT ':=',
  `value` varchar(253) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=64 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `radgroupcheck` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `groupname` varchar(64) NOT NULL DEFAULT '',
  `attribute` varchar(64) NOT NULL DEFAULT '',
  `op` char(2) NOT NULL DEFAULT '==',
  `value` varchar(253) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `groupname` (`groupname`(32))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `radgroupreply` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `groupname` varchar(64) NOT NULL DEFAULT '',
  `attribute` varchar(64) NOT NULL DEFAULT '',
  `op` char(2) NOT NULL DEFAULT '=',
  `value` varchar(253) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `groupname` (`groupname`(32))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `radius_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` int DEFAULT NULL,
  `username` varchar(255) NOT NULL,
  `plano_id` int DEFAULT NULL,
  `nas_id` int DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_radius_users_empresa` (`empresa_id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `radpostauth` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(64) NOT NULL DEFAULT '',
  `pass` varchar(64) NOT NULL DEFAULT '',
  `reply` varchar(32) NOT NULL DEFAULT '',
  `authdate` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `class` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `username` (`username`),
  KEY `class` (`class`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `radreply` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(64) NOT NULL,
  `attribute` varchar(64) NOT NULL,
  `op` char(2) NOT NULL DEFAULT ':=',
  `value` varchar(253) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `radusergroup` (
  `username` varchar(64) NOT NULL,
  `groupname` varchar(64) NOT NULL,
  `priority` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_snapshots` (
  `table_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `columns_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `indexes_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `create_sql` longtext COLLATE utf8mb4_unicode_ci,
  `snapshot_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`table_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_backups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `update_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipo` enum('pre_update','manual') COLLATE utf8mb4_unicode_ci DEFAULT 'manual',
  `db_dump_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `files_zip_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `update_apply_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `update_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `step` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('info','ok','erro') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `message` text COLLATE utf8mb4_unicode_ci,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_update_id` (`update_id`),
  KEY `idx_criado_em` (`criado_em`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `update_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `update_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_content` longtext COLLATE utf8mb4_unicode_ci,
  `action` enum('create','update','delete') COLLATE utf8mb4_unicode_ci DEFAULT 'update',
  PRIMARY KEY (`id`),
  KEY `update_id` (`update_id`),
  CONSTRAINT `update_files_ibfk_1` FOREIGN KEY (`update_id`) REFERENCES `updates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=79 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `update_migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `update_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sql_content` text COLLATE utf8mb4_unicode_ci,
  `ordem` int DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `update_id` (`update_id`),
  CONSTRAINT `update_migrations_ibfk_1` FOREIGN KEY (`update_id`) REFERENCES `updates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `updates` (
  `id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descricao` text COLLATE utf8mb4_unicode_ci,
  `changelog` text COLLATE utf8mb4_unicode_ci,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `whatsapp_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` int NOT NULL,
  `portal_id` int DEFAULT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `mensagem` text,
  `contexto_tipo` varchar(50) DEFAULT NULL,
  `referencia_id` int DEFAULT NULL,
  `status` enum('ok','erro','skipped') NOT NULL,
  `erro_msg` text,
  `skip_motivo` varchar(50) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wa_logs_empresa_data` (`empresa_id`,`criado_em`),
  KEY `idx_wa_logs_status` (`status`),
  KEY `idx_wa_logs_portal` (`portal_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- ============================================================
-- DADOS INICIAIS (seed)
-- ============================================================

-- Empresa padrao
INSERT INTO `empresas` (`id`, `nome`, `slug`, `email`, `ativo`, `criado_em`, `atualizado_em`) VALUES
(1, 'Empresa Padrao', 'default', 'admin@empresa.com', 1, NOW(), NOW());

-- Super admin: hash gerado durante a instalacao
INSERT INTO `admins` (`id`, `empresa_id`, `email`, `role`, `password`, `created_at`) VALUES
(1, 1, 'admin@empresa.com', 'super_admin', 'INITIAL_ADMIN_HASH', NOW());

-- Vincular admin a empresa
INSERT INTO `admin_empresas` (`admin_id`, `empresa_id`, `role`, `criado_em`) VALUES
(1, 1, 'owner', NOW());

-- 5 portais padrao da empresa 1
INSERT INTO `portais` (`empresa_id`, `nome`, `slug`, `tipo`, `url_redirect`, `ativo`, `criado_em`) VALUES
(1, 'LGPD - Coleta de Dados', 'lgpd', 'lgpd', '/cadastro', 1, NOW()),
(1, 'Planos - Pagamento', 'planos', 'planos', '/planos-cliente', 1, NOW()),
(1, 'Cadastro de LEAD', 'lead', 'lead', '/lead', 1, NOW()),
(1, 'Cadastro de LEAD (Sem Internet)', 'lead-passivo', 'lead_passivo', '/lead-passivo', 1, NOW()),
(1, 'Acesso Wi-Fi', 'login', 'login', '/login-hotspot', 1, NOW());

-- Planos padrao LGPD e Lead (mikrotik_id temporario, vinculado ao cadastrar MikroTik)
SET FOREIGN_KEY_CHECKS=0;
INSERT INTO `planos` (`empresa_id`, `nome`, `valor`, `duracao_minutos`, `velocidade_down`, `velocidade_up`, `mikrotik_id`, `shared_users`) VALUES
(1, 'LGPD', 0.00, 5, '15', '30', 0, 10),
(1, 'Lead', 0.00, 1, '15', '30', 0, 10);
SET FOREIGN_KEY_CHECKS=1;

-- Controle de sync
INSERT INTO `connection_logs_sync` (`id`, `last_synced_radacctid`, `synced_at`) VALUES (1, 0, NOW());

-- Portal templates (HTML reutilizavel)
INSERT INTO `portal_templates` VALUES (1,'Portal Basico','Portal simples de login WiFi com botao de conexao. Ideal para hotspots que precisam apenas autenticar o usuario.',NULL,'<!DOCTYPE html>\n<html lang=\"pt-BR\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>WiFi Gratuito</title>\n  <style>\n    * { margin: 0; padding: 0; box-sizing: border-box; }\n    body {\n      font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;\n      background: linear-gradient(135deg, #0f111a 0%, #1a1d2e 50%, #0f111a 100%);\n      min-height: 100vh;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      color: #e2e8f0;\n    }\n    .container {\n      background: rgba(26, 29, 39, 0.95);\n      border: 1px solid rgba(59, 130, 246, 0.2);\n      border-radius: 20px;\n      padding: 40px;\n      max-width: 420px;\n      width: 90%;\n      text-align: center;\n      box-shadow: 0 25px 50px rgba(0,0,0,0.5);\n    }\n    .logo-area { margin-bottom: 24px; }\n    .logo-area .icon {\n      width: 64px; height: 64px;\n      background: linear-gradient(135deg, #3B82F6, #8B5CF6);\n      border-radius: 16px;\n      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n      font-size: 28px;\n      margin-bottom: 16px;\n    }\n    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }\n    .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 32px; }\n    .btn-connect {\n      display: block;\n      width: 100%;\n      padding: 14px;\n      background: linear-gradient(135deg, #3B82F6, #2563EB);\n      color: white;\n      border: none;\n      border-radius: 12px;\n      font-size: 16px;\n      font-weight: 600;\n      cursor: pointer;\n      transition: all 0.3s;\n      text-decoration: none;\n    }\n    .btn-connect:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(59,130,246,0.4); }\n    .info { margin-top: 20px; font-size: 12px; color: #64748b; }\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <div class=\"logo-area\">\n      <div class=\"icon\">&#x1F4F6;</div>\n      <h1>WiFi Gratuito</h1>\n      <p class=\"subtitle\">Conecte-se a internet de forma rapida e segura</p>\n    </div>\n    <a href=\"/hotspot/auth?mac=$(mac)&ip=$(ip)&mikrotik_id=$(mikrotik_id)&empresa_id=$(empresa_id)\" class=\"btn-connect\">\n      Conectar Agora\n    </a>\n    <p class=\"info\">MAC: $(mac) | IP: $(ip)</p>\n  </div>\n</body>\n</html>',NULL,'basico','2026-03-25 00:00:16'),(2,'Portal com Planos','Portal que exibe planos com precos e links para pagamento. Ideal para monetizar o acesso WiFi.',NULL,'<!DOCTYPE html>\n<html lang=\"pt-BR\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>WiFi - Escolha seu Plano</title>\n  <style>\n    * { margin: 0; padding: 0; box-sizing: border-box; }\n    body {\n      font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;\n      background: linear-gradient(135deg, #0f111a 0%, #1a1d2e 50%, #0f111a 100%);\n      min-height: 100vh;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      color: #e2e8f0;\n      padding: 20px;\n    }\n    .container {\n      max-width: 800px;\n      width: 100%;\n      text-align: center;\n    }\n    .header { margin-bottom: 40px; }\n    .header .icon {\n      width: 64px; height: 64px;\n      background: linear-gradient(135deg, #3B82F6, #8B5CF6);\n      border-radius: 16px;\n      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n      font-size: 28px;\n      margin-bottom: 16px;\n    }\n    h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }\n    .subtitle { color: #94a3b8; font-size: 15px; }\n    .plans {\n      display: grid;\n      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));\n      gap: 20px;\n      margin-bottom: 30px;\n    }\n    .plan-card {\n      background: rgba(26, 29, 39, 0.95);\n      border: 1px solid rgba(59, 130, 246, 0.15);\n      border-radius: 16px;\n      padding: 30px 24px;\n      transition: all 0.3s;\n    }\n    .plan-card:hover { border-color: #3B82F6; transform: translateY(-4px); box-shadow: 0 12px 30px rgba(59,130,246,0.2); }\n    .plan-card.featured { border-color: #3B82F6; background: rgba(59,130,246,0.08); }\n    .plan-card .badge {\n      display: inline-block;\n      background: #3B82F6;\n      color: white;\n      font-size: 11px;\n      font-weight: 600;\n      padding: 4px 12px;\n      border-radius: 20px;\n      margin-bottom: 12px;\n    }\n    .plan-name { font-size: 18px; font-weight: 600; margin-bottom: 8px; }\n    .plan-speed { font-size: 32px; font-weight: 800; color: #3B82F6; margin-bottom: 4px; }\n    .plan-unit { font-size: 14px; color: #64748b; }\n    .plan-price { font-size: 14px; color: #94a3b8; margin: 16px 0; }\n    .plan-price strong { font-size: 24px; color: white; }\n    .btn-plan {\n      display: block;\n      width: 100%;\n      padding: 12px;\n      background: linear-gradient(135deg, #3B82F6, #2563EB);\n      color: white;\n      border: none;\n      border-radius: 10px;\n      font-size: 14px;\n      font-weight: 600;\n      cursor: pointer;\n      text-decoration: none;\n      transition: all 0.3s;\n    }\n    .btn-plan:hover { box-shadow: 0 6px 20px rgba(59,130,246,0.4); }\n    .free-access {\n      background: rgba(26, 29, 39, 0.8);\n      border: 1px solid rgba(100,116,139,0.2);\n      border-radius: 12px;\n      padding: 16px;\n    }\n    .free-access a {\n      color: #94a3b8;\n      text-decoration: underline;\n      font-size: 14px;\n    }\n    .info { margin-top: 16px; font-size: 12px; color: #475569; }\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <div class=\"header\">\n      <div class=\"icon\">&#x1F4F6;</div>\n      <h1>Escolha seu Plano</h1>\n      <p class=\"subtitle\">Selecione o plano ideal para voce e navegue com velocidade</p>\n    </div>\n    <div class=\"plans\">\n      <div class=\"plan-card\">\n        <div class=\"plan-name\">Basico</div>\n        <div class=\"plan-speed\">5</div>\n        <div class=\"plan-unit\">Mbps</div>\n        <div class=\"plan-price\"><strong>R$ 9,90</strong>/mes</div>\n        <a href=\"/planos-cliente?mac=$(mac)&ip=$(ip)&mikrotik_id=$(mikrotik_id)&empresa_id=$(empresa_id)\" class=\"btn-plan\">Assinar</a>\n      </div>\n      <div class=\"plan-card featured\">\n        <span class=\"badge\">POPULAR</span>\n        <div class=\"plan-name\">Turbo</div>\n        <div class=\"plan-speed\">20</div>\n        <div class=\"plan-unit\">Mbps</div>\n        <div class=\"plan-price\"><strong>R$ 29,90</strong>/mes</div>\n        <a href=\"/planos-cliente?mac=$(mac)&ip=$(ip)&mikrotik_id=$(mikrotik_id)&empresa_id=$(empresa_id)\" class=\"btn-plan\">Assinar</a>\n      </div>\n      <div class=\"plan-card\">\n        <div class=\"plan-name\">Ultra</div>\n        <div class=\"plan-speed\">50</div>\n        <div class=\"plan-unit\">Mbps</div>\n        <div class=\"plan-price\"><strong>R$ 49,90</strong>/mes</div>\n        <a href=\"/planos-cliente?mac=$(mac)&ip=$(ip)&mikrotik_id=$(mikrotik_id)&empresa_id=$(empresa_id)\" class=\"btn-plan\">Assinar</a>\n      </div>\n    </div>\n    <div class=\"free-access\">\n      <a href=\"/hotspot/auth?mac=$(mac)&ip=$(ip)&mikrotik_id=$(mikrotik_id)&empresa_id=$(empresa_id)&free=1\">Acessar gratis com velocidade limitada</a>\n    </div>\n    <p class=\"info\">MAC: $(mac) | IP: $(ip)</p>\n  </div>\n</body>\n</html>',NULL,'planos','2026-03-25 00:00:16'),(3,'Portal LGPD + Planos','Portal completo com consentimento LGPD, formulario de cadastro e exibicao de planos. Conformidade total com a legislacao brasileira.',NULL,'<!DOCTYPE html>\n<html lang=\"pt-BR\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>WiFi - Cadastro e Planos</title>\n  <style>\n    * { margin: 0; padding: 0; box-sizing: border-box; }\n    body {\n      font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;\n      background: linear-gradient(135deg, #0f111a 0%, #1a1d2e 50%, #0f111a 100%);\n      min-height: 100vh;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      color: #e2e8f0;\n      padding: 20px;\n    }\n    .container {\n      max-width: 500px;\n      width: 100%;\n    }\n    .card {\n      background: rgba(26, 29, 39, 0.95);\n      border: 1px solid rgba(59, 130, 246, 0.2);\n      border-radius: 20px;\n      padding: 36px;\n      box-shadow: 0 25px 50px rgba(0,0,0,0.5);\n    }\n    .header { text-align: center; margin-bottom: 28px; }\n    .header .icon {\n      width: 64px; height: 64px;\n      background: linear-gradient(135deg, #3B82F6, #8B5CF6);\n      border-radius: 16px;\n      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n      font-size: 28px;\n      margin-bottom: 16px;\n    }\n    h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }\n    .subtitle { color: #94a3b8; font-size: 14px; }\n    .step { display: none; }\n    .step.active { display: block; }\n    label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; font-weight: 500; }\n    input[type=\"text\"], input[type=\"email\"], input[type=\"tel\"] {\n      width: 100%;\n      padding: 12px 14px;\n      background: #0d1117;\n      border: 1px solid rgba(100,116,139,0.3);\n      border-radius: 10px;\n      color: white;\n      font-size: 14px;\n      margin-bottom: 16px;\n      outline: none;\n      transition: border-color 0.3s;\n    }\n    input:focus { border-color: #3B82F6; }\n    .lgpd-box {\n      background: rgba(13, 17, 23, 0.8);\n      border: 1px solid rgba(100,116,139,0.2);\n      border-radius: 10px;\n      padding: 16px;\n      margin-bottom: 20px;\n      font-size: 12px;\n      color: #94a3b8;\n      max-height: 120px;\n      overflow-y: auto;\n      line-height: 1.6;\n    }\n    .checkbox-row {\n      display: flex;\n      align-items: flex-start;\n      gap: 10px;\n      margin-bottom: 20px;\n    }\n    .checkbox-row input[type=\"checkbox\"] {\n      margin-top: 2px;\n      accent-color: #3B82F6;\n    }\n    .checkbox-row span { font-size: 13px; color: #94a3b8; }\n    .btn {\n      display: block;\n      width: 100%;\n      padding: 14px;\n      background: linear-gradient(135deg, #3B82F6, #2563EB);\n      color: white;\n      border: none;\n      border-radius: 12px;\n      font-size: 15px;\n      font-weight: 600;\n      cursor: pointer;\n      transition: all 0.3s;\n      text-decoration: none;\n      text-align: center;\n    }\n    .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(59,130,246,0.4); }\n    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }\n    .btn-secondary {\n      background: transparent;\n      border: 1px solid rgba(100,116,139,0.3);\n      color: #94a3b8;\n      margin-top: 10px;\n    }\n    .btn-secondary:hover { background: rgba(100,116,139,0.1); box-shadow: none; }\n    .plans-grid { display: grid; gap: 12px; margin-bottom: 20px; }\n    .plan-option {\n      background: #0d1117;\n      border: 2px solid rgba(100,116,139,0.2);\n      border-radius: 12px;\n      padding: 16px;\n      cursor: pointer;\n      transition: all 0.3s;\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n    }\n    .plan-option:hover, .plan-option.selected { border-color: #3B82F6; }\n    .plan-option .left .name { font-weight: 600; font-size: 15px; }\n    .plan-option .left .speed { color: #64748b; font-size: 13px; }\n    .plan-option .price { font-size: 18px; font-weight: 700; color: #3B82F6; }\n    .info { text-align: center; margin-top: 16px; font-size: 12px; color: #475569; }\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <div class=\"card\">\n      <div class=\"header\">\n        <div class=\"icon\">&#x1F4F6;</div>\n        <h1>WiFi Gratuito</h1>\n        <p class=\"subtitle\">Cadastre-se para acessar a internet</p>\n      </div>\n\n      <!-- Step 1: LGPD Consent -->\n      <div class=\"step active\" id=\"step1\">\n        <label>Termos de Uso e Privacidade (LGPD)</label>\n        <div class=\"lgpd-box\">\n          Em conformidade com a Lei Geral de Protecao de Dados (LGPD - Lei 13.709/2018), informamos que os dados pessoais coletados neste cadastro serao utilizados exclusivamente para fins de autenticacao na rede WiFi e cumprimento das obrigacoes legais previstas no Marco Civil da Internet (Lei 12.965/2014). Seus dados serao armazenados de forma segura e nao serao compartilhados com terceiros sem seu consentimento expresso. Voce tem direito de solicitar acesso, correcao ou exclusao dos seus dados a qualquer momento.\n        </div>\n        <div class=\"checkbox-row\">\n          <input type=\"checkbox\" id=\"lgpd-consent\" onchange=\"document.getElementById(\'btn-next\').disabled = !this.checked\">\n          <span>Li e concordo com os termos de uso e politica de privacidade</span>\n        </div>\n        <button class=\"btn\" id=\"btn-next\" disabled onclick=\"document.getElementById(\'step1\').classList.remove(\'active\');document.getElementById(\'step2\').classList.add(\'active\');\">\n          Continuar\n        </button>\n      </div>\n\n      <!-- Step 2: Registration -->\n      <div class=\"step\" id=\"step2\">\n        <label>Nome completo</label>\n        <input type=\"text\" id=\"nome\" placeholder=\"Seu nome\">\n        <label>CPF</label>\n        <input type=\"text\" id=\"cpf\" placeholder=\"000.000.000-00\">\n        <label>E-mail</label>\n        <input type=\"email\" id=\"email\" placeholder=\"seu@email.com\">\n        <label>Telefone</label>\n        <input type=\"tel\" id=\"telefone\" placeholder=\"(00) 00000-0000\">\n        <button class=\"btn\" onclick=\"document.getElementById(\'step2\').classList.remove(\'active\');document.getElementById(\'step3\').classList.add(\'active\');\">\n          Prosseguir\n        </button>\n      </div>\n\n      <!-- Step 3: Plans -->\n      <div class=\"step\" id=\"step3\">\n        <label style=\"margin-bottom:14px;\">Escolha um plano</label>\n        <div class=\"plans-grid\">\n          <div class=\"plan-option\" onclick=\"this.parentElement.querySelectorAll(\'.plan-option\').forEach(e=>e.classList.remove(\'selected\'));this.classList.add(\'selected\');\">\n            <div class=\"left\"><div class=\"name\">Basico</div><div class=\"speed\">5 Mbps</div></div>\n            <div class=\"price\">R$ 9,90</div>\n          </div>\n          <div class=\"plan-option\" onclick=\"this.parentElement.querySelectorAll(\'.plan-option\').forEach(e=>e.classList.remove(\'selected\'));this.classList.add(\'selected\');\">\n            <div class=\"left\"><div class=\"name\">Turbo</div><div class=\"speed\">20 Mbps</div></div>\n            <div class=\"price\">R$ 29,90</div>\n          </div>\n          <div class=\"plan-option\" onclick=\"this.parentElement.querySelectorAll(\'.plan-option\').forEach(e=>e.classList.remove(\'selected\'));this.classList.add(\'selected\');\">\n            <div class=\"left\"><div class=\"name\">Ultra</div><div class=\"speed\">50 Mbps</div></div>\n            <div class=\"price\">R$ 49,90</div>\n          </div>\n        </div>\n        <a href=\"/planos-cliente?mac=$(mac)&ip=$(ip)&mikrotik_id=$(mikrotik_id)&empresa_id=$(empresa_id)\" class=\"btn\">\n          Assinar Plano\n        </a>\n        <a href=\"/hotspot/auth?mac=$(mac)&ip=$(ip)&mikrotik_id=$(mikrotik_id)&empresa_id=$(empresa_id)&free=1\" class=\"btn btn-secondary\">\n          Acesso gratuito limitado\n        </a>\n      </div>\n\n      <p class=\"info\">MAC: $(mac) | IP: $(ip)</p>\n    </div>\n  </div>\n</body>\n</html>',NULL,'completo','2026-03-25 00:00:16'),(4,'Cadastro de LEAD (Sem Internet)','Portal focado apenas na captura de contatos (nome, email, telefone). Exibe uma tela de obrigado e NÃO libera internet. Ideal para prospecção passiva.',NULL,'<!DOCTYPE html>\n<html lang=\"pt-BR\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>WiFi - Conecte-se</title>\n  <style>\n    body { background: #0f111a; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }\n    .box { text-align: center; }\n  </style>\n  <script>\n    setTimeout(function() {\n      window.location.href = \"/lead-passivo?mac=$(mac)&ip=$(ip)&mikrotik_id=$(mikrotik_id)\";\n    }, 1000);\n  </script>\n</head>\n<body>\n  <div class=\"box\">\n    <h2>Redirecionando...</h2>\n  </div>\n</body>\n</html>',NULL,'lead_passivo','2026-03-27 20:14:32');
