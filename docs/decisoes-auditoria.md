# Decisões da auditoria Beco

## Cancelamento e estorno

Antes do estorno de pedido pago, `cancelamentos_ingresso` registra a intenção e uma chave UUID. A consulta pública, recuperação, reparo e check-in suspendem ingressos enquanto existir tarefa pendente. O estorno só é aceito se a resposta confirmar `approved` e o mesmo `payment_id`. O contrato do provedor exige [X-Idempotency-Key](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/create-refund/post).

Uma lease de 120 segundos evita trabalho simultâneo na mesma tarefa. A chamada tem timeout de 15 segundos. Após confirmação, pedido, ingressos, estoque, cupom e tarefa são atualizados juntos na transação. Falha SQL mantém a tarefa para retomada com a mesma chave. O agendador tenta novamente ao iniciar e a cada cinco minutos; um processo encerrado libera trabalho após expiração da lease. A lease é verificada novamente na conclusão. Isso permite repetir requisições ao provedor; não implica um novo estorno financeiro a cada tentativa.

Pedido pendente usa alteração condicional dentro da transação. Se uma confirmação vencer a corrida, cancelar retorna 409 e preserva a venda e as reservas de outros pedidos.

Pedidos pagos sem ID de pagamento e inconsistências de estoque/emissão exigem revisão; o código não inventa IDs ou ajusta contagens silenciosamente. Tarefas que continuam falhando permanecem suspensas e geram logs para conciliação. O comportamento do provedor foi testado por simulação, sem estorno real ou homologação de conta.

## Emissão e webhook

Reparo de pedido pago trava a linha do pedido, lê os ingressos existentes e emite apenas as unidades faltantes por lote, na mesma transação. Ingressos já emitidos e seus códigos são preservados. Quantidades extras, lotes estranhos ou ingressos cancelados são inconsistências para revisão.

O webhook rejeita IDs divergentes entre query e corpo; assinatura e consulta usam o mesmo ID. O ID externo da notificação não substitui data.id. As verificações de valor, moeda e referência permanecem.

## Loja e paginação

Uma geração identifica cada cotação. Respostas antigas são descartadas; alterar quantidade/cupom invalida o total e a compra confere também o payload atual. Falha permite nova tentativa explícita. Desmontagem ou troca de evento invalida respostas pendentes. Ordenação alfabética de eventos usa id como desempate estável.

## Seed

Somente cria admin com credenciais explícitas. Não promove produtor nem redefine senha de conta existente. As duas propostas remotas foram avaliadas sem mesclar suas regressões de credenciais padrão e senha mínima. A importação do módulo para testes não lê arquivos de ambiente; apenas a execução CLI os carrega.
