# Empresas, unidades e portais

O painel **Unidades e portais** organiza os locais da empresa, seus equipamentos e os portais de acesso. Superadmins mantêm acesso global; administradores da empresa acessam todas as unidades. Na aba **Permissões**, escolha as unidades autorizadas para cada usuário padrão. Usuários sem unidades atribuídas não recebem acesso aos dados dos locais.

## Criar e publicar um portal

1. Cadastre as unidades e associe cada MikroTik a uma unidade.
2. Crie um portal e configure aparência, campos do formulário, autenticação, regras de acesso, privacidade e equipamentos.
3. Salve o rascunho e confira a prévia. Mudanças de rascunho não alteram o portal publicado.
4. Publique para colocar a versão em uso nos equipamentos selecionados. Cada equipamento mantém um portal ativo.

Ao substituir um portal em um equipamento, a nova página será usada nas próximas conexões. A publicação não reescreve as condições das credenciais já concedidas. O usuário que estiver preenchendo uma versão anterior deverá recarregar a página antes de enviar o cadastro.

Clonar cria um rascunho independente, sem equipamentos vinculados e sem copiar visitantes, pagamentos ou registros de acesso. Um gestor de unidade não pode editar um portal compartilhado com unidades fora da sua autorização.

Portais anteriores continuam funcionando até sua conversão e publicação no novo editor. Sua primeira versão fica registrada como configuração anterior. O editor anterior permanece disponível para administradores da empresa durante a transição. APIs antigas que consultam ou modificam toda a empresa são restritas aos administradores; usuários de unidades utilizam as APIs e telas do novo painel.

## Cadastro e acesso

O compartilhamento de cadastro entre unidades é configurável por empresa. Alterar essa opção afeta os próximos cadastros; não funde nem elimina o histórico anterior. O reaproveitamento de dados no formulário utiliza a identificação assinada da sessão do navegador; conhecer um MAC ou informar o telefone de outra pessoa não dá acesso ao cadastro dela. Código WhatsApp verifica a posse do telefone. Para exigir telefone verificado, deixe habilitado somente o método WhatsApp.

O código tem validade de cinco minutos, cinco tentativas de validação, intervalo mínimo de um minuto e até três envios em quinze minutos por telefone na empresa. A proteção por origem admite até 150 envios nesse intervalo, considerando que vários visitantes podem compartilhar o IP público da loja. Uma falha de envio não libera internet. Configure a integração WhatsApp da empresa antes de publicar este método.

CPF é um campo configurável, validado quando incluído, e não é utilizado como senha. Credenciais de acesso são aleatórias, temporárias e vinculadas ao NAS e MAC. Aceite de termos e autorização de marketing são separados; marketing permanece opcional.

## Planos e recebimentos

O novo fluxo admite acesso gratuito, pago ou ambos, com PIX pelo Mercado Pago. Preços existentes permanecem armazenados em centavos; a cobrança converte para reais. Cartões dos portais anteriores continuam disponíveis no fluxo anterior durante a transição.

Cada unidade herda a conta Mercado Pago da empresa ou utiliza uma configuração própria na seção **Recebimentos**. A cobrança guarda a conta e as condições utilizadas na criação do pedido. Notificações provocam verificação diretamente no Mercado Pago; valores informados no navegador ou no corpo do webhook não aprovam pedidos. Aprovação repetida utiliza a mesma concessão de acesso. Não há acesso antecipado no novo fluxo.

Configure `SYSTEM_PUBLIC_URL` com a URL HTTPS pública do sistema para receber as notificações. Se não configurada, o sistema utiliza o domínio existente. O acompanhamento da página também verifica a situação do PIX. Configure o domínio público e o acesso do cliente à página antes da liberação pelo hotspot.

## Registros e privacidade

Cada novo acesso registra empresa, unidade, equipamento e versão do portal. O sincronizador reconcilia início, atualizações e término das sessões RADIUS sem apagar o histórico para permitir reconexões. Registros antigos não recebem unidade presumida. Exportações e consultas do novo painel geram auditoria.

Defina enquadramento, fundamento e prazos na aba **Privacidade**. Até essa definição, a rotina não remove registros de conexão, NAT, auditoria ou cadastros. A rotina diária remove registros encerrados fora dos prazos configurados, preserva conexões em retenção excepcional e anonimiza cadastros elegíveis. Solicitações pendentes impedem anonimização automática. A política deve ser definida conforme as responsabilidades e hipóteses legais da operação; o software não substitui essa definição.

O visitante pode consultar seus dados, pedir correção ou exclusão e revogar marketing em **Meus dados**, utilizando a identificação válida da sessão. O administrador acompanha as solicitações e registra respostas. A exclusão respeita os prazos configurados e preservações aplicáveis.

RADIUS, isoladamente, não fornece necessariamente os mapeamentos de NAT. O painel sinaliza quando não há demonstração dessa coleta. A API de coleta recebe eventos de um coletor autorizado:

```http
POST /api/captive/collectors/{equipamento_id}/nat
Authorization: Bearer CHAVE_DO_COLETOR
Content-Type: application/json
```

```json
{"records":[{"ip_privado":"10.5.50.20","porta_privada":54000,"ip_publico":"203.0.113.20","porta_publica":60000,"protocolo":"tcp","inicio":"2026-10-05T12:00:00Z","fim":"2026-10-05T12:05:00Z"}]}
```

A chave é gerada por equipamento e exibida uma única vez. O coletor efetivo depende da topologia e deve obter os dados na borda que realiza NAT; essa integração precisa ser homologada no ambiente. Não são coletados conteúdo de navegação nem senhas nos relatórios.

## Homologação e atualização

A migração 018 cria a unidade inicial e associa os equipamentos existentes, preservando portais e registros. Aplicar primeiro em `develop`, com backup do banco e da aplicação. A branch `main` permanece destinada à produção homologada.

O teste `backend/tests/multiunits.integration.js` exige banco isolado com prefixo `mec_validation_`. Ele exercita empresas distintas, permissões, clonagem, versões, cadastros, privacidade, códigos, pagamentos simulados e registros RADIUS. Não envia mensagens nem efetua cobranças reais.

MikroTik é o primeiro conector. Outras marcas, vouchers e login social não fazem parte desta versão. Antes de produção, validar em MikroTik real o redirecionamento, RADIUS, MAC/NAS, limites de banda e tempo, contabilização e a coleta de NAT da rede. Também homologar WhatsApp e Mercado Pago com as contas da operação.
# Organização atual

A partir da versão 0.2.0, o fluxo é **Operadora MEC Solution → Empresas → Portais → Equipamentos**. Consulte [ORGANIZACAO.md](ORGANIZACAO.md). As instruções de unidades abaixo documentam a versão 0.1.0 e não representam o fluxo atual de cadastro.

