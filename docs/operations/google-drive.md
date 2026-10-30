# Configuração do Google Drive

O catálogo de demonstração funciona sem credenciais externas. Conectar, sincronizar, enviar e baixar arquivos reais exige um projeto Google Cloud.

## Preparação

1. Ative a Google Drive API no projeto Google Cloud.
2. Configure a tela de consentimento OAuth e os usuários de teste, quando aplicável.
3. Crie um cliente OAuth do tipo aplicação Web.
4. Cadastre `http://localhost:3001/api/v1/drive/oauth/callback` como URI de redirecionamento no desenvolvimento.
5. Preencha `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` no `.env`.
6. Gere chaves separadas para `TOKEN_ENCRYPTION_KEY` (32 bytes em Base64) e `OAUTH_STATE_SECRET` (pelo menos 32 caracteres).

Exemplo multiplataforma para gerar a chave de criptografia com Node.js:

```text
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

## Escopo e proteção

Os tokens ficam somente na API e são protegidos com AES-256-GCM. A interface recebe apenas sessões de upload retomável e nunca recebe o refresh token. Em produção, chaves devem ser armazenadas no cofre de segredos da plataforma, não em arquivos.

O escopo atual permite acesso ao Drive porque o portal precisa catalogar arquivos preexistentes. Antes da homologação, valide a tela de consentimento, a política de menor privilégio e as exigências de verificação do Google para o contexto institucional.

## Prova de conceito obrigatória

Faça testes com arquivos reais grandes antes da campanha. Confirme CORS das sessões retomáveis, renovação de token, cotas, perda de rede, retomada e consumo de memória. O endpoint de download transmite o corpo em streaming; ele não carrega o arquivo inteiro na memória da API.

