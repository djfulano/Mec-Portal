# Histórico de versões do Mec Portal

A versão instalada aparece no rodapé do menu lateral. Clique nela para consultar as alterações de cada versão.

O histórico começa com **1.0.0**, a entrega de empresas, unidades e portais em 05/10/2026. A versão **1.1.0** acrescenta a exibição da versão e o histórico no painel. As entregas anteriores não receberam números retroativamente.

## Como registrar uma atualização

Antes de publicar, acrescente uma entrada no início de `hotspot/frontend/src/releases.json`, com número, data, título e alterações. A primeira entrada define automaticamente a versão exibida no painel e o selo Atual no histórico. Mantenha as entradas anteriores.

Use `MAJOR.MINOR.PATCH`: aumente MAJOR para mudanças incompatíveis; MINOR para funcionalidades; PATCH para correções. Registre a data da entrega no formato `AAAA-MM-DD`. Escreva as alterações em linguagem voltada ao usuário e não inclua informações confidenciais.

O histórico acompanha a compilação instalada. Uma atualização publicada na develop só aparecerá na produção após a instalação da versão correspondente da main.
