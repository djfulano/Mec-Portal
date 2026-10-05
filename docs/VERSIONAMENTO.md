# Histórico de versões do Mec Portal

A versão instalada aparece no rodapé do menu lateral, acima do e-mail e do botão Sair. Somente superadmins podem clicar nela para consultar o histórico. Os demais usuários veem apenas o texto da versão.

O histórico começa com **0.1.0 — Versão de testes**, em 05/10/2026, reunindo a entrega de empresas, unidades, portais e histórico de versões. Essa numeração substitui os rótulos iniciais 1.0.0 e 1.1.0 para indicar que o sistema ainda está em testes.

## Como registrar uma atualização

Antes de publicar, acrescente uma entrada no início de `hotspot/frontend/src/releases.json`, com número, data, título e alterações. A primeira entrada define automaticamente a versão exibida no painel e o selo Atual no histórico. Mantenha as entradas anteriores.

Use `MAJOR.MINOR.PATCH`: aumente MAJOR para mudanças incompatíveis; MINOR para funcionalidades; PATCH para correções. Registre a data da entrega no formato `AAAA-MM-DD`. Escreva as alterações em linguagem voltada ao usuário e não inclua informações confidenciais.

O histórico acompanha a compilação instalada. Uma atualização publicada na develop só aparecerá na produção após a instalação da versão correspondente da main.
