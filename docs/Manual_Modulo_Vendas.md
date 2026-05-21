# Manual do Sistema - Modulo de Vendas (QSERPx)

## 1. Objetivo do manual
Este manual orienta o uso do Modulo de Vendas do QSERPx, com foco em navegacao e execucao das operacoes do dia a dia.

Escopo deste documento:
- Pedidos de Venda
- Pedidos de Venda Representantes
- Dashboard de Vendas

Publico-alvo:
- Usuario final (comercial e representantes)

---

## 2. Visao geral do modulo
No modulo de Vendas voce consegue:
- Consultar pedidos
- Incluir novos pedidos
- Editar pedidos em elaboracao
- Duplicar pedidos
- Excluir pedidos
- Importar itens por planilha (fluxo de representantes)
- Imprimir pedido em PDF
- Analisar indicadores no Dashboard de Vendas

---

## 3. Navegacao do modulo
### 3.1 Entradas no menu
Use o menu lateral e selecione uma das opcoes de Vendas:
- Pedidos de Venda
- Pedidos de Venda Representantes
- Dashboard - Vendas

### 3.2 Botao de retorno
Nas telas de Vendas, o icone de voltar no topo retorna para a Home.

---

## 4. Submodulo: Pedidos de Venda

## 4.1 Objetivo da tela
Centralizar consulta e manutencao de pedidos de venda.

## 4.2 Estrutura da tela
A tela possui:
- Cabecalho com titulo da pagina
- Resumo com Total de registros
- Campo de busca rapida: Pesquisar na lista de pedidos
- Acoes por icones:
  - Filtros avancados
  - Atualizar
  - Novo pedido (icone +)
- Tabela com colunas:
  - Numero
  - Data
  - Cliente
  - Vendedor
  - Situacao
  - Valor
  - Acoes

---

## 4.3 Operacao: consultar pedidos
### Quando usar
Quando precisar localizar um pedido existente.

### Passo a passo
1. Acesse Pedidos de Venda (ou Pedidos de Venda Representantes).
2. Aguarde o carregamento da lista.
3. Use o campo Pesquisar na lista de pedidos para filtrar rapidamente.
4. Clique na linha do pedido para abrir a consulta detalhada.

### Resultado esperado
- O pedido abre em modo de consulta (somente leitura).

---

## 4.4 Operacao: usar filtros avancados
### Quando usar
Quando precisar filtrar por periodo, numero ou situacao.

### Passo a passo
1. Clique no icone de Filtros avancados.
2. Preencha os campos desejados:
   - Data de
   - Data ate
   - Numero
   - Situacao
3. Clique em Aplicar.

### Regras importantes
- Data de e Data ate devem ser informadas juntas.
- Datas invalidas impedem a aplicacao.
- Data de nao pode ser maior que Data ate.

### Resultado esperado
- Lista recarregada com os filtros aplicados.

---

## 4.5 Operacao: ordenar a listagem
### Quando usar
Quando precisar priorizar visualizacao por numero, data, cliente, vendedor, situacao ou valor.

### Passo a passo
1. Clique no nome da coluna desejada.
2. Clique novamente para alternar entre crescente e decrescente.

### Resultado esperado
- Ordem da tabela alterada conforme o criterio.

---

## 4.6 Operacao: incluir novo pedido
### Quando usar
Quando for registrar um novo pedido de venda.

### Passo a passo
1. Clique no icone + (Novo pedido).
2. No formulario, preencha cabecalho e itens.
3. Revise os totais.
4. Clique em Confirmar.

### Campos principais do cabecalho
- Cliente *
- Condicao pgto *
- Vendedor *
- Desconto do cliente (%)
- Frete
- Desconto aplicado (%)
- Transportadora
- Frete por conta
- Destino pedido
- Representante (quando aplicavel)
- % Comissao rep. (quando aplicavel)

### Regras importantes
- Campos com * sao obrigatorios.
- Cliente, condicao e vendedor devem ter codigos validos para salvar.
- O valor total do pedido e recalculado com base nos itens, frete e descontos.

### Resultado esperado
- Mensagem de sucesso: Pedido incluido com sucesso.
- Pedido salvo e disponivel na listagem.

---

## 4.7 Operacao: incluir e gerenciar itens do pedido
### Quando usar
Durante criacao ou edicao do pedido.

### Passo a passo (inclusao manual)
1. Na secao Itens do pedido, clique em Incluir item.
2. Preencha os campos do item:
   - Codigo do produto *
   - Qtd *
   - Preco *
   - Pedido cliente
   - Data entrega
3. Use o campo Busca (lupa) para consultar Tabela de precos quando necessario.
4. Clique em adicionar/salvar item.

### Resultado esperado
- Item inserido na grade.
- Total item e totais gerais recalculados.

### Operacoes por item
- Editar item (mobile: ao abrir item)
- Excluir item (icone lixeira)

---

## 4.8 Operacao: consultar tabela de precos
### Quando usar
Quando precisar buscar produto por codigo/descricao e aplicar preco da tabela.

### Passo a passo
1. No item, clique no botao de busca (lupa).
2. Digite codigo ou descricao em Pesquisar item.
3. Clique em Buscar.
4. Na lista retornada, clique em Selecionar no item desejado.

### Resultado esperado
- Produto, unidade e preco sao carregados no item.

---

## 4.9 Operacao: editar pedido
### Quando usar
Quando for necessario corrigir ou atualizar um pedido existente.

### Regra de negocio
- Apenas pedidos em situacao Elaboracao podem ser editados.

### Passo a passo
1. Na lista, clique no icone Editar da linha.
2. Ajuste os dados necessarios.
3. Clique em Confirmar.

### Resultado esperado
- Mensagem de sucesso: Pedido alterado com sucesso.

---

## 4.10 Operacao: duplicar pedido
### Quando usar
Quando precisar criar um novo pedido com base em um pedido ja existente.

### Passo a passo
1. Na lista, clique no icone Duplicar.
2. O sistema abre um novo formulario com os dados copiados.
3. Ajuste o que for necessario.
4. Clique em Confirmar.

### Resultado esperado
- Novo pedido criado a partir da copia.

---

## 4.11 Operacao: excluir pedido
### Quando usar
Quando um pedido foi criado indevidamente e precisa ser removido.

### Passo a passo
1. Na lista, clique no icone Excluir (lixeira).
2. No modal Confirmar exclusao, clique em Excluir.

### Resultado esperado
- Mensagem de sucesso: Pedido excluido com sucesso.
- Pedido removido da listagem.

---

## 4.12 Operacao: consultar detalhes e imprimir PDF
### Quando usar
Quando precisar revisar o pedido sem alterar dados e/ou emitir documento.

### Passo a passo
1. Clique na linha do pedido para abrir consulta.
2. Revise cabecalho, itens e totais.
3. Clique em Imprimir PDF para gerar o arquivo.
4. Clique em Fechar para sair da consulta.

### Resultado esperado
- PDF do pedido gerado.

---

## 4.13 Operacao: importacao de planilha (Representantes)
Este fluxo e usado no contexto de Pedidos de Venda Representantes.

### 4.13.1 Pre-requisitos
- Cliente informado no pedido.
- Pedido cliente e Data de entrega informados para a importacao.
- Planilha no formato esperado.

### 4.13.2 Baixar modelo
1. Clique no botao Baixar planilha.
2. O sistema abre o modelo oficial para preenchimento.

### 4.13.3 Formato obrigatorio da planilha
Cabecalho esperado exatamente nesta ordem:
- Codigo Drw:
- Qtde:

Se o cabecalho estiver diferente, a importacao e bloqueada.

### 4.13.4 Passo a passo da importacao
1. Clique em Importar planilha.
2. Informe Pedido cliente e Data de entrega.
3. Confirme para selecionar o arquivo Excel (.xlsx/.xls).
4. Aguarde a validacao e revise a pre-visualizacao.
5. Corrija quantidade ou remova itens invalidos, se necessario.
6. Clique em Confirmar para carregar itens no pedido.

### 4.13.5 Status de validacao da planilha
- OK: item valido
- X: item invalido
- I: item inativo
- S/Tabela: item sem tabela de preco

Regra:
- Enquanto existir item com status diferente de OK, a confirmacao da importacao e bloqueada.

### 4.13.6 Resultado esperado
- Itens da planilha carregados no pedido.
- Usuario deve revisar e salvar o pedido para concluir.

---

## 4.14 Totais e conferencia final do pedido
Antes de confirmar, valide sempre:
- Total de itens
- Quantidade total
- Valor itens
- Valor pedido

Dica operacional:
- Sempre confira desconto aplicado e frete antes de confirmar.

---

## 5. Diferencas entre Pedidos de Venda e Pedidos de Venda Representantes
- Pedidos de Venda Representantes usam fluxo especifico com recursos de planilha.
- No fluxo de representantes, alguns campos de cabecalho podem ficar com comportamento restrito.
- Em representantes, e comum iniciar com situacao Elaboracao e filtro por emitente conforme permissao.

---

## 6. Submodulo: Dashboard - Vendas

## 6.1 Objetivo da tela
Acompanhar desempenho comercial por periodo com indicadores e visoes analiticas.

## 6.2 Estrutura da tela
A tela apresenta:
- Filtro de destinatario (Todos ou Clientes)
- Filtros avancados por data (Data de e Data ate)
- Atualizar
- Indicadores KPI
- Grafico Faturamento por regiao
- Grafico Top 10 clientes por tipo de faturamento
- Grade resumo por cliente
- Exportacao da grade para Excel
- Alerta de moedas sem cotacao (quando houver)

---

## 6.3 Operacao: aplicar filtros no dashboard
### Passo a passo
1. Ajuste Destinatario para Todos ou Clientes.
2. Clique em Filtros avancados.
3. Informe Data de e Data ate.
4. Clique em Aplicar.
5. Clique em Atualizar quando necessario.

### Regras importantes
- Data de e Data ate sao obrigatorias no filtro avancado.
- Data de nao pode ser maior que Data ate.

### Resultado esperado
- Dashboard atualizado para o periodo informado.

---

## 6.4 Como ler os KPIs
Indicadores exibidos:
- Faturamento total
- Total mercadoria
- Total de impostos
- Total em atraso
- Total previsto (forecast)
- Clientes faturados

Uso pratico:
- Compare faturamento x atraso para identificar risco de recebimento.
- Use clientes faturados para monitorar carteira ativa.

---

## 6.5 Como ler Faturamento por regiao
### Passo a passo
1. Passe o mouse sobre as regioes no grafico.
2. Consulte o painel de legenda e top 3 clientes por regiao.

### Resultado esperado
- Identificacao rapida das regioes com maior receita.

---

## 6.6 Como ler Top 10 clientes por tipo de faturamento
### Passo a passo
1. Localize o cliente no ranking.
2. Clique na linha do cliente para expandir detalhes.
3. Veja os 5 itens com maior valor faturado.

### Resultado esperado
- Entendimento de mix de venda e concentracao por cliente.

---

## 6.7 Operacao: exportar resumo para Excel
### Passo a passo
1. Com dados carregados, clique no icone de exportacao da grade resumo.
2. Aguarde o download do arquivo.

### Resultado esperado
- Arquivo Excel com consolidado por cliente.

---

## 6.8 Alerta de moedas sem cotacao
Quando aparecer o aviso de moedas sem cotacao:
- Considere os totais com cautela.
- Solicite regularizacao da cotacao antes de decisoes finais.

---

## 7. Regras de permissao no modulo
As acoes podem variar por perfil de usuario.

Exemplos:
- Consultar pedido
- Editar pedido
- Excluir pedido
- Duplicar pedido

Se uma acao nao estiver permitida, o sistema exibira mensagem de bloqueio.

---

## 8. Erros comuns e como resolver
## 8.1 Nao foi possivel aplicar filtro por data
Causa provavel:
- Data invalida ou periodo inconsistente.

Como resolver:
1. Confira formato de data.
2. Preencha Data de e Data ate juntas.
3. Garanta que Data de <= Data ate.

## 8.2 Nao consigo editar o pedido
Causa provavel:
- Pedido nao esta em Elaboracao.

Como resolver:
1. Verifique a situacao do pedido.
2. Edite apenas pedidos em Elaboracao.

## 8.3 Falha ao salvar pedido
Causas provaveis:
- Campo obrigatorio vazio.
- Codigo invalido de cliente, condicao ou vendedor.

Como resolver:
1. Revise campos obrigatorios com *.
2. Reescolha os dados em listas validas.

## 8.4 Erro na importacao de planilha
Causas provaveis:
- Cabecalho diferente do modelo.
- Itens invalidos/inativos/sem tabela.
- Pedido cliente ou Data de entrega nao informados.

Como resolver:
1. Use o modelo oficial.
2. Corrija/remova itens com status X, I ou S/Tabela.
3. Informe Pedido cliente e Data de entrega antes da importacao.

## 8.5 Dashboard sem dados
Causas provaveis:
- Periodo sem movimento.
- Filtro muito restritivo.

Como resolver:
1. Amplie o periodo.
2. Troque Destinatario entre Todos e Clientes.
3. Clique em Atualizar.

---

## 9. Boas praticas operacionais
- Sempre aplique filtros antes de analisar lista grande.
- Na inclusao, preencha cabecalho antes dos itens.
- Revise totais e descontos antes de confirmar.
- Em importacao por planilha, valide status antes de confirmar.
- No dashboard, valide periodo e escopo antes de exportar.

---

## 10. Checklist rapido (uso diario)
Use esta sequencia para evitar retrabalho:
1. Entrar na tela correta (Pedidos ou Dashboard).
2. Aplicar filtros necessarios.
3. Executar operacao (consultar, incluir, editar, etc.).
4. Conferir mensagens de sucesso/erro.
5. Revisar totais finais.
6. Exportar ou imprimir quando necessario.

---

## 11. Sugestao para treinamento interno
Roteiro sugerido para capacitacao:
1. Consulta e filtros de pedidos.
2. Inclusao manual de pedido com 2 itens.
3. Edicao e duplicacao de pedido.
4. Importacao por planilha (representantes).
5. Consulta detalhada e impressao PDF.
6. Leitura do Dashboard e exportacao Excel.

Esse roteiro cobre o ciclo operacional completo do modulo de vendas.
