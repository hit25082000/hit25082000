# Dia

Planejador diário em português, com toda a janela dedicada ao trabalho: anotações, entrega principal, tarefas, lembretes e blocos de horário.

## Semana e planejamento a partir de anotações

- A terceira aba, **Semana**, mostra segunda a domingo com resultados e anotações da semana, entregas diárias e agenda compartilhada com a visão do dia.
- As cores representam **deep work** (azul), **shallow work** (verde), **desfrute** (âmbar) e outros compromissos (rosé). Fundos suaves indicam disponibilidade; cartões sólidos são blocos confirmados.
- O botão de configurações permite definir múltiplos períodos por dia da semana. A configuração inicial é uma sugestão editável, não um registro da rotina real do usuário. Segunda pode ser copiada para terça a sexta. Dias sem períodos ficam indisponíveis para sugestões.
- **Transformar em plano** usa o trecho selecionado ou as anotações completas, uma ação por linha, até 40 linhas. A classificação é feita localmente por palavras-chave, sem chamada a modelos externos. Durações explícitas, como `30min` ou `1h`, são reconhecidas.
- As sugestões buscam o primeiro intervalo livre do tipo da atividade, descontam compromissos e outras sugestões do lote, evitam horários passados e posicionam desfrute após o trabalho. Na visão semanal, a busca respeita a semana exibida.
- Itens já existentes mostram o horário real do agendamento, ou informam que uma tarefa não reserva horário. Eles ficam desmarcados e não recebem novas sugestões.
- Cada recomendação selecionada recebe um intervalo distinto. Escolhas manuais são reservadas antes das sugestões automáticas, independentemente da ordem das linhas; conflitos manuais bloqueiam a confirmação. A gravação também valida novamente todos os intervalos do lote.
- Antes de confirmar, é possível ajustar tipo, duração, destino (tarefa ou agendamento), data e início. Ajustes manuais de horário podem ficar fora da disponibilidade e são validados contra conflitos. Não há divisão automática de uma atividade em vários blocos.
- Se não houver espaço, o sistema não cria um agendamento: é necessário reduzir a duração, ajustar os períodos ou manter o item como tarefa. As anotações originais são preservadas, e a inclusão do lote pode ser desfeita.

## Uso

- A data no topo abre dias anteriores ou futuros.
- As divisórias podem ser arrastadas ou ajustadas pelas setas do teclado. Um clique duplo restaura as proporções.
- “Só escrever” expande as anotações para toda a área de trabalho.
- Cada linha da agenda permite criar um bloco; clicar em um bloco permite editar ou excluir.
- O menu contém tema claro/escuro, exportação JSON, exportação Markdown e importação de backup.

## Dados

Os dados são salvos automaticamente no `localStorage` do navegador, sob `dia.planner.v1`. Não há sincronização entre dispositivos. Limpar os dados do navegador pode apagar o caderno; o backup JSON permite transferir ou restaurar os dias, semanas e configurações de foco. O importador valida as datas, campos e horários e pede confirmação antes de substituir dados existentes. O formato original continua aceito e as notas, tarefas, conclusão, detalhes e cores de blocos antigos são preservados.

O dia atual e a linha de horário usam America/Cuiaba. A configuração inicial tem anotações em 48% da área e prioridades em 25%; a agenda usa o restante.

## Estrutura

Aplicação Vinext no Worker do Sites. O planejador existente permanece em `public/planner.html` e seus scripts em `public/`; `/` redireciona para ele. O backend autenticado está em `app/api/jev/route.ts`, com validação em `server/jev.mjs`. O manifesto `.openai/hosting.json` mantém o mesmo projeto e origem, preservando o armazenamento local existente. Use o helper oficial `build-site.mjs` para gerar `dist/` e publicar.

## Verificação

Verificados no navegador: persistência após recarregar, separação por data, conclusão de tarefa e entrega, criação e exclusão de blocos, rejeição de sobreposição, modo de escrita, ajuste de divisórias, períodos personalizados copiados entre dias, conversão em tarefas e agendamentos, ajuste manual do horário, cores na semana, preservação das notas, alternativa sem espaço e desfazer o lote.

`node tests/planner-core.test.cjs` cobre 27 cenários de classificação, encaixe, migração e validação. A sintaxe dos três arquivos JavaScript deve passar em `node --check`.

## Ganho, prevenção e revisão de pendências

Cada tarefa e bloco pode ter uma finalidade (produção de ganho, prevenção de perda, rotina/pessoal ou a classificar), independente de deep/shallow/desfrute. Tarefas também têm prioridade alta/média/baixa e prazo opcional. O dia alerta quando não há tarefa ou bloco de ganho; a conclusão de uma tarefa de ganho é registrada separadamente da reserva de tempo. O aviso não inventa tarefas e não impede dias sem trabalho.

A revisão inclui tarefas abertas de dias anteriores e tarefas futuras cujo prazo já é exigível. A ordenação é explícita: prazo vencido/hoje, prioridade escolhida e ganho no desempate; depois prazo e data original. O ganho prioritário pendente tem destaque próprio. Trazer uma pendência para o dia move o registro, sem copiá-lo, e permite desfazer.

O botão de sugestão local usa palavras-chave, exige revisão e não altera classificações já escolhidas. A opção separada **IA · Jev** envia somente as tarefas selecionadas para a TypeSafe, através do backend. O usuário revisa finalidade e prioridade antes de aplicar; a alteração pode ser desfeita. A IA não modifica datas nem cria horários.

Validação adicional: `node tests/priorities.test.cjs` (8 cenários), além dos 27 testes de planejamento e 10 de lembretes. Verificados no navegador: edição de finalidade/prioridade/prazo, prevenção com prazo antes de ganho, preservação após recarregar, recuperação sem duplicação e registro de ganho concluído.


## Jev e segredo na nuvem

O backend usa `jev-1.14.0` em `https://api.typesafe.ai/v1/systemone`. O navegador chama somente `/api/jev`. A chave fica no runtime do servidor, nunca no HTML, JavaScript público ou armazenamento local.

1. Cadastre `TYPESAFE_API_KEY` como segredo no ambiente de produção do Sites (`is_secret: true`). Não cole a chave no chat ou no código.
2. Se usar um vault externo, disponibilize esse segredo ao runtime com o mesmo nome. A sincronização depende do produto de vault e deve ser configurada explicitamente; não existe sincronização automática implementada.
3. Publique novamente uma versão salva depois de alterar o ambiente, para aplicar a nova revisão.
4. Abra **Mais opções → IA · Jev → Verificar configuração**. O status confirma apenas presença do segredo. Uma análise real, com uma tarefa selecionada, confirma a credencial e a resposta do provedor. Essa validação depende de uma chave real e pode consumir créditos.

Sem segredo, o backend retorna 503 e nenhuma análise é feita. Chamadas exigem a identidade ChatGPT fornecida pelo Sites; o preview local sem sessão retorna 401. O site continua com acesso privado. O endpoint aceita até 10 tarefas (500 caracteres cada), contexto opcional de 800 caracteres e corpo de até 16 KB. Tem verificação de origem, timeout de 15 segundos, validação de respostas e proteção contra repetição da mesma solicitação por dois minutos. O limite de seis análises por minuto por usuário é por instância do Worker; não substitui uma cota global ou limite de gastos do provedor. Erros não revelam a chave ou respostas brutas. Não há repetição automática de chamadas pagas.

O envio é explícito: títulos, prazos e contexto selecionados são enviados à TypeSafe. As notas completas e o restante do caderno não são enviados. A disponibilidade de um segredo não comprova que ele seja válido; não foi feito teste real sem credencial.

Verificação desta integração: `node --test tests/jev.test.mjs` (11 testes), mais os 45 cenários existentes de planejamento, prioridades e lembretes; `node node_modules/typescript/bin/tsc --noEmit`; build oficial do Sites. Os testes usam um provedor simulado e não consomem créditos.

## Ambiente compartilhado GitHub/Codex

O código também está em `sites/dia/` no repositório `hit25082000/hit25082000`. Veja [CODEX.md](CODEX.md) para cadastrar o segredo JEV no ambiente, verificar sua presença e aplicar a configuração separadamente no site publicado.
