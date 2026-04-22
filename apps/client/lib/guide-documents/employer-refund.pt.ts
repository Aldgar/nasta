export const EMPLOYER_REFUND_PT = `# Política de Reembolso

A Nasta utiliza o sistema de garantia (escrow) da Stripe para proteger os seus pagamentos. Eis como funcionam os reembolsos na plataforma.

## Como Funcionam os Pagamentos

Quando aceita um prestador de serviços para um trabalho:

- O seu pagamento é cobrado imediatamente e mantido em segurança pela Stripe
- Os fundos permanecem em garantia durante toda a duração do trabalho
- O pagamento só é libertado para o prestador de serviços quando confirma que o trabalho está concluído

## Quando Recebe um Reembolso Automático

### Não Comparência do Prestador de Serviços

Se um prestador de serviços não comparecer a um trabalho confirmado, recebe um **reembolso automático total**. Eis o processo:

1. A hora de início agendada passa
2. O código de verificação não foi utilizado (o prestador de serviços não fez check-in)
3. Reporta a não comparência através da aplicação
4. O sistema confirma a não comparência
5. O reembolso total é emitido automaticamente para o seu método de pagamento original

## Quando os Reembolsos Automáticos Não Estão Disponíveis

Uma vez aceite um trabalho e efetuado o pagamento, os reembolsos automáticos **não estão disponíveis** nos seguintes casos:

- O prestador de serviços compareceu e iniciou o trabalho
- O trabalho foi parcialmente concluído
- Tem uma disputa sobre a qualidade do trabalho

## Disputas e Reembolsos Manuais

Para situações não cobertas por reembolsos automáticos:

1. **Abrir um Pedido de Suporte** — Vá ao separador Contacto e descreva o problema em detalhe
2. **Fornecer Provas** — Inclua fotografias ou qualquer documentação relevante
3. **A Nossa Equipa Analisa** — A equipa de suporte irá investigar utilizando os registos do código de verificação, o histórico de movimentação do trabalho e o histórico de comunicação
4. **Resolução** — Se a reclamação for válida, pode ser emitido um reembolso parcial ou total

**Importante:** As disputas de pagamento devem ser reportadas antes da conclusão do trabalho ser confirmada.

## Cancelamento Antes do Serviço

- Se cancelar um trabalho antes do prestador de serviços iniciar, é emitido um reembolso total para o seu método de pagamento original
- O cancelamento só está disponível antes do código de verificação ser ativado

## Taxas da Plataforma

- As taxas da plataforma não são reembolsáveis, exceto se o reembolso se dever a uma não comparência ou a um erro verificado da plataforma
- Todas as estruturas de taxas são divulgadas antes do pagamento ser efetuado

## Tempos de Processamento

- **Reembolsos automáticos (não comparência):** Processados imediatamente, aparecem em 3-5 dias úteis
- **Reembolsos manuais (suporte):** Analisados e tratados no prazo de 48 horas, depois deve aguardar 3-5 dias úteis para a Stripe processar para o seu método de pagamento original
`;
