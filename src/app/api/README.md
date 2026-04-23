# LegendaAI API

Base URL: https://legendaai.com.br/api

## Autenticação
Todas as rotas protegidas requerem header:
Authorization: Bearer {session_token}

## Endpoints

### Vídeos
POST   /videos              — Criar vídeo após upload
GET    /videos              — Listar vídeos do usuário
GET    /videos/:id          — Detalhes de um vídeo
PATCH  /videos/:id          — Atualizar título/estilo
DELETE /videos/:id          — Deletar vídeo

### Transcrições
GET    /transcriptions/:videoId         — Obter segmentos
PATCH  /transcriptions/:videoId         — Atualizar segmentos editados
GET    /transcriptions/:videoId/srt     — Exportar SRT
GET    /transcriptions/:videoId/vtt     — Exportar VTT

### Billing
GET    /billing/plans          — Listar planos disponíveis com preços
POST   /billing/checkout       — Criar assinatura recorrente (retorna initPoint MP)
POST   /billing/portal         — Dados do plano atual + histórico de pagamentos
POST   /billing/avulso         — Iniciar pagamento avulso (PIX ou Cartão via MP)
GET    /billing/avulso/:id     — Status do pagamento avulso (polling frontend)
POST   /billing/webhook/mercadopago — Webhook IPN Mercado Pago (interno)

### Usuário
GET    /user/me           — Dados do usuário atual + plano
GET    /user/usage        — Uso do mês atual
PATCH  /user/me           — Atualizar dados do perfil
