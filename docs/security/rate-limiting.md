# Limitação de requisições

Rotas sensíveis do Hermes aplicam limites por janela de tempo tanto ao endereço IP quanto ao usuário ou e-mail envolvido. Os contadores ficam no PostgreSQL, portanto continuam consistentes quando a API possui mais de uma instância.

Os limites protegem login, criação de uploads e downloads, eventos de progresso, convites, OAuth, sincronização do Drive e encerramento da campanha. Quando um limite é excedido, a API responde com HTTP `429`, código `RATE_LIMITED` e o campo `retryAfterSeconds`.

Cabe ao proxy reverso substituir, e não apenas anexar, os cabeçalhos `X-Forwarded-For` e `X-Real-IP`. Sem essa normalização, um cliente poderia fornecer um IP arbitrário. Mesmo nessa situação, o segundo contador por usuário ou e-mail continua ativo.

Os registros vencidos são removidos durante o uso do limitador. Os valores iniciais ficam no código da API e devem ser revistos com métricas reais antes de aumentar a escala ou expor a aplicação publicamente.
