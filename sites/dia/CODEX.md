# Dia no ambiente compartilhado do Codex

Código do site Dia importado para `hit25082000/hit25082000`, em `sites/dia/`.
Origem da importação: commit `bd676facf0c4a0700f820f40f99c43f0c49bea2b` do repositório de origem do Sites.

Site publicado: https://dia-luizao-planejamento.luiz-domingues750471.chatgpt.site
Projeto existente: `appgprj_6addfa0dfb308191944f3ac69f2dd445`.
A publicação continua no Sites. GitHub e o ambiente de desenvolvimento do Codex não são a hospedagem de produção.

## Cadastrar a chave com segurança

1. Abra a configuração do ambiente do Codex ligado a este repositório.
2. Na seção **Segredos**, adicione `TYPESAFE_API_KEY` e insira ali a chave da TypeSafe/JEV. Não use uma variável comum e não cole o valor em uma tarefa, conversa, arquivo versionado ou comando de terminal.
3. Salve a configuração e abra uma nova tarefa com esse ambiente para aplicar o segredo. A disponibilidade no processo depende das fases e das permissões de injeção do ambiente.
4. Onde o segredo estiver disponível, execute `cd sites/dia && npm run jev:check`. Esse comando informa somente a presença da variável. Não envia a chave, não consulta o provedor e não comprova validade nem configuração em produção.

O ambiente atualmente inspecionado não tinha esse segredo cadastrado. O código inclui somente `.env.example` sem valor. `.env*` e `.dev.vars*` estão ignorados pelo Git, com exceção do exemplo vazio.

## Ativar no site publicado

O segredo do Codex não é sincronizado automaticamente com o Sites. Depois do cadastro, solicite ao Codex que configure a chave no runtime do projeto existente, usando a ferramenta nativa de ambiente do Sites com `is_secret: true`, e publique novamente uma versão salva para aplicar a nova revisão. Isso exige que o ambiente disponibilize a credencial por um caminho seguro; não a copie para o chat para contornar uma limitação de acesso.

Mantenha o valor fora do código, dos argumentos de shell, dos logs, dos arquivos de build e de `.openai/hosting.json`. O manifesto contém apenas o identificador do projeto e os bindings de armazenamento.

Abra **Mais opções → IA · Jev → Verificar configuração** no Dia. O status mostra apenas presença do segredo em produção. Uma análise explícita de uma tarefa confirma o acesso real à TypeSafe e pode consumir créditos. Nenhuma chamada real ao provedor foi feita nesta importação.

## Desenvolvimento e verificação

```sh
cd sites/dia
npm test
npm run install:ci
npm run dev
```

Os testes não precisam de chave e usam um provedor simulado. Para builds, use `npm run build` após instalar as dependências. Consulte o skill Sites no Codex para empacotar e publicar.

## Manutenção e publicação

Este diretório permite trabalhar no projeto pelo GitHub/Codex. O Sites ainda mantém seu próprio repositório de publicação: um push neste GitHub não atualiza o site automaticamente. Antes de publicar, confira mudanças posteriores no repositório do Sites, reconcilie o código e siga o fluxo oficial do plugin Sites com o mesmo `project_id`. Não crie outro Site e preserve o acesso privado.

As notas e tarefas continuam no armazenamento local do navegador. Elas não fazem parte desta importação e não foram migradas para o GitHub nem para um banco de dados.
