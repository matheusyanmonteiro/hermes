# Auditoria de transferências

O Hermes registra acontecimentos distintos para evitar conclusões imprecisas:

- `AUTHORIZED`: a API aceitou a solicitação e autorizou o arquivo.
- `STARTED` / `IN_PROGRESS`: a transferência de bytes foi iniciada.
- `COMPLETED_CLIENT`: o navegador informou que recebeu e gravou todo o fluxo.
- `FAILED` / `CANCELLED`: houve falha ou cancelamento identificável.
- `UNKNOWN`: o resultado não pôde ser confirmado.

Uma aplicação Web não consegue provar universalmente que um arquivo permanece salvo no dispositivo depois da transferência. Por isso, relatórios e planilhas usam o termo “recebimento completo informado pelo cliente”, nunca “arquivo definitivamente salvo”.

## Integridade dos registros

- O evento guarda usuário, horário UTC, correlação e quantidade de bytes.
- A transferência preserva um retrato do nome, tamanho, MIME e origem mesmo que o vídeo seja removido.
- Chaves de idempotência impedem lotes duplicados em repetições da requisição.
- A máquina de estados recusa reabrir transferências finalizadas.
- Usuários comuns não recebem endpoints para editar eventos brutos ou logs administrativos.

## Navegadores e arquivos grandes

Chrome e Edge permitem gravar o stream diretamente no destino escolhido pelo usuário por meio da File System Access API. Em navegadores sem esse recurso, a interface só usa o fallback em memória para arquivos de até 128 MiB; arquivos maiores exibem uma orientação em vez de arriscar o esgotamento de memória.

