# Organização do Mec Portal — 0.2.0 (testes)

**Operadora MEC Solution → Empresas → Portais → Equipamentos.**

A MEC Solution é a operadora única. Seus superadmins gerenciam todas as empresas pelo painel da operadora. Usuários das empresas acessam somente suas empresas, conforme as permissões dos seus grupos.

## Cadastro e utilização

1. No painel da operadora, cadastre a empresa e vincule seus administradores ou usuários.
2. Acesse a empresa e abra **Portais e equipamentos**. Crie um portal, configure aparência, cadastro, autenticação, acesso e privacidade e salve o rascunho.
3. Em **Equipamentos**, cadastre o equipamento e selecione obrigatoriamente um portal dessa empresa. Um equipamento tem exatamente um portal; vários equipamentos podem selecionar o mesmo portal.
4. Publique o portal. Todos os equipamentos vinculados passam a usar essa versão. Um portal também pode ser publicado antes de receber equipamentos.
5. Para trocar o portal de um equipamento, edite seu cadastro. Se o novo portal ainda não foi publicado, o acesso ficará indisponível até a publicação. Sessões já concedidas conservam suas condições originais.

Publicar um portal não transfere equipamentos entre portais. A aba Equipamentos do editor mostra os vínculos definidos nos cadastros. Clonar gera um rascunho independente, sem equipamentos vinculados. Para excluir um portal, transfira ou remova seus equipamentos primeiro.

Empresas novas começam sem portais prontos. Unidades deixaram de fazer parte do fluxo de cadastro e das permissões dos usuários. As tabelas técnicas de unidades permanecem para compatibilidade com registros, pagamentos e integrações anteriores; o sistema cria esse contexto automaticamente, sem exigir escolha no cadastro do equipamento. Não são um nível da organização apresentada ao usuário.

## Ambiente de testes

O banco e a aplicação do Debian foram copiados antes da limpeza dos cadastros de teste. Superadmins, configurações da instalação e registros de migração foram preservados. A limpeza é uma operação específica do ambiente de testes; não é executada automaticamente pela instalação ou atualização do GitHub.

A validação com equipamento MikroTik real continua pendente. A existência de configurações de privacidade não representa garantia de conformidade jurídica.
