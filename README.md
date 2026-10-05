# Portal Hotspot

Portal, FreeRADIUS, Evolution API e WireGuard em Debian ou Ubuntu, com acesso por portas e Cloudflare Tunnel.

## Ambientes

- `develop`: testes. O Debian 192.168.156.27 e o ambiente de testes.
- `main`: producao. Recebe somente versoes aprovadas apos validar em testes.

O banco, `.env`, certificados, uploads e senhas pertencem a cada servidor. Nao sao copiados entre testes e producao nem publicados no GitHub. Nao use os mesmos dominios publicos para os dois servidores simultaneamente; configure dominios exclusivos para testes.

## Instalacao nova

Autentique o servidor no GitHub com uma chave de leitura se o repositorio for privado. Copie `install-from-git.sh` para o novo servidor e execute, substituindo a URL:

```bash
sudo bash install-from-git.sh https://github.com/djfulano/Mec-Portal.git production
```

Para um servidor novo de testes, troque `production` por `testing`. O instalador clona a versao correta para `/opt/hotspot-source`. Escolha a opcao 3 para acesso por IP ou Cloudflare Tunnel. Portas padrao: portal 8081, Evolution 8090. O banco inicial e importado somente na primeira instalacao.

O email inicial e `admin@empresa.com`. Cada instalacao gera uma senha aleatoria, salva somente em `/root/hotspot-credenciais.txt`.

## Atualizacao

```bash
sudo git -C /opt/hotspot-source pull --ff-only
sudo bash /opt/hotspot-source/update.sh
```

O script busca a branch do ambiente, compila a nova versao, cria uma copia completa da aplicacao e um backup SQL em `/var/backups/hotspot`, aplica apenas migrations pendentes e reinicia o backend. Preserva dados e configuracoes locais. Ha uma breve interrupcao durante migrations e troca do backend.

Em falha, restaura o codigo anterior. Alteracoes de estrutura SQL podem fazer auto-commit: a restauracao do banco exige revisao e uso do backup, evitando descartar dados novos automaticamente.

Nao execute `install.sh` para atualizar: ele recusa servidores com `.env` existente. Instalacoes antigas precisam ser registradas e ter suas migrations validadas antes de usar `update.sh`.

## Publicar uma versao

1. Altere o codigo em `develop` e passe pela validacao do GitHub.
2. Atualize e teste o servidor de testes.
3. Aprove a alteracao de `develop` para `main` e registre uma tag de versao.
4. Execute `update.sh` no servidor de producao quando desejar instalar a versao aprovada.

A publicacao de codigo no GitHub nao atualiza producao automaticamente. A tela antiga de atualizacoes via servidor externo nao e o mecanismo de atualizacao deste repositorio; use o script acima.

## Validacao da primeira versao

Verificado no Debian 13: scripts Bash, build do frontend, atualizacao com backup, rollback do codigo em falha, acesso ao portal/API/Evolution e execucao unica de 15 migrations. O banco inicial e a senha aleatoria foram validados em uma base temporaria. A instalacao completa de um segundo servidor ainda deve ser acompanhada.
