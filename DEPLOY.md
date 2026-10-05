# Publicar o app

O objetivo e ter uma URL https fixa para instalar o app no iPhone (Safari >
Compartilhar > Adicionar a Tela de Inicio) sem depender do PC ligado.

Local nada muda: `python manage.py runserver` continua funcionando sem definir
variavel nenhuma.

## Sem autenticacao, de proposito

O app nao tem login, e isso e escolha: o destino dele e um host 100% local no
homelab, onde a propria rede e o portao. Enquanto estiver numa URL publica,
porem, quem souber o endereco ve e edita tudo -- entao prefira um tunel ou um
portao do provedor a um endereco aberto. Os caminhos estao em "Se um dia
precisar de portao", no fim deste arquivo.

## Variaveis de ambiente

Cadastre no painel do provedor. O modelo completo esta em `.env.example`.

| Variavel | Obrigatoria | Para que serve |
| --- | --- | --- |
| `SECRET_KEY` | sim | assina cookies e tokens. 50+ caracteres aleatorios |
| `DEBUG` | sim | `0`. Com `1` o provedor exibe traceback e dados na tela de erro |
| `ALLOWED_HOSTS` | nao no Railway | o dominio. No Railway sai do `RAILWAY_PUBLIC_DOMAIN` sozinho; defina so se usar dominio proprio |
| `CSRF_TRUSTED_ORIGINS` | nao no Railway | idem, com esquema: `https://estudos.exemplo.com` |
| `DATABASE_URL` | sim | Postgres. **Nao aparece sozinha**: veja "Ligar o app ao banco" |
| `MEDIA_ROOT` | se usa anexos | caminho de um disco persistente, ex. `/dados/arquivos` |
| `SECURE_SSL_REDIRECT` | nao | `1` por padrao; desligue so se o provedor ja forca https |

Gerar a chave:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## Ligar o app ao banco

Criar o Postgres nao conecta nada. As variaveis dele (`DATABASE_URL`,
`DATABASE_PUBLIC_URL`, `PGHOST`...) nascem **no servico do Postgres**, e o
servico do app nao as ve -- ele sobe em SQLite, dentro de um disco efemero, e
voce descobre quando os dados somem no deploy seguinte.

Quem liga os dois e uma variavel de referencia, no servico do **app**:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

`Postgres` ai e o nome do servico do banco, como esta no painel. Renomeou? A
referencia tem de acompanhar, senao ela aponta para um host que nao existe.

Referencia, e nao a URL copiada: a Railway resolve na hora do deploy, entao
rotacao de senha ou troca de host continuam valendo sem voce reeditar o campo.

Use a `DATABASE_URL` (privada, `postgres.railway.internal`) e nao a
`DATABASE_PUBLIC_URL`. A privada fica na rede interna; a publica sai pelo proxy
TCP, e mais lenta e conta como trafego de saida. A publica serve para conectar
da sua maquina -- veja "Quando o app responde 500 em tudo".

Para confirmar que pegou, nos logs do deploy, antes do gunicorn:

```
banco respondeu (postgresql) na tentativa 1
Applying estudos.0001_initial... OK
```

Se vier `banco respondeu (sqlite)`, a variavel nao chegou ao servico do app.

## Deploy automatico

`railway.json` descreve build, migrate e start, entao **nao preencha campo de
build nem de start no painel**: valor ali sobrescreve o arquivo e e dificil de
lembrar depois. O Railway le o `railway.json` a cada push na branch que ele
observa e publica sozinho.

O build e um `Dockerfile`, e nao o Nixpacks, de proposito: o detector de Django
do Nixpacks acrescenta `python manage.py migrate` ao build sem pedir licenca, e
no build nao existe rede privada -- `postgres.railway.internal` nao resolve ali
em nenhuma circunstancia. O deploy morria nisso, e nao havia campo para limpar
que resolvesse, porque o comando nao vinha de campo nenhum.

- build: o `Dockerfile` -- instala as dependencias e roda o collectstatic
- start: `esperar_banco && migrate --noinput && gunicorn config.wsgi ...`
- healthcheck: `/perfis/`, que responde 200 sem depender de cookie

O `migrate` fica no **start**, nao num `preDeployCommand` nem na linha
`release:` do Procfile. As duas alternativas foram tentadas e nenhuma rodou: o
Railway ignora o `release:` (convencao do Heroku) e o preDeploy passou batido,
deixando o Postgres sem tabela nenhuma e o app dando 500 em tudo. No start ele
roda dentro do container, com a rede privada de pe, e nao ha configuracao de
painel que o pule. Migrar e idempotente: repetir a cada boot nao custa nada.

Por isso o `healthcheckTimeout` e 180s -- o primeiro boot tem o migrate inteiro
antes do gunicorn abrir a porta.

O healthcheck aponta para `/perfis/` e nao para `/`, porque `/` responde 302
para la quando nao ha perfil escolhido.

No painel do Railway, uma vez: ligar o repo, escolher a branch observada e
criar o Postgres como servico. O resto e push.

`.github/workflows/testes.yml` roda a suite, confere se falta migration e
valida a configuracao de producao em cada push e PR. Nao e ele que publica --
isso e o Railway -- mas e o que faz o commit quebrado aparecer marcado no
GitHub antes de voce notar pelo celular.

## Quando o app responde 500 em tudo

Quase sempre e banco sem tabela: o `migrate` nao rodou e a primeira consulta
morre com `relation "estudos_perfil" does not exist`. Confira nos logs do start
se aparece o `migrate` antes do gunicorn.

Para migrar na hora, da sua maquina, sem esperar deploy -- o host interno nao
resolve de fora, entao vai pela URL publica:

```bash
railway variables       # copie o valor de DATABASE_PUBLIC_URL
DATABASE_URL="<a public url>" python manage.py migrate
```

O traceback de um 500 aparece nos logs porque o `settings.py` define `LOGGING`
mandando `django.request` para a saida padrao. Sem isso o Django, com
`DEBUG=0`, manda erro por email para `ADMINS` -- que nao existe aqui -- e o 500
nao aparece em lugar nenhum.

## Quando o app responde 400 em tudo

E `DisallowedHost`: o Django recebeu uma requisicao para um host que nao esta em
`ALLOWED_HOSTS` e recusou antes de olhar a URL. Nos logs aparece como
`Invalid HTTP_HOST header`.

No Railway isso se resolve sozinho: o `settings.py` le o `RAILWAY_PUBLIC_DOMAIN`
que o proprio Railway injeta e monta a lista a partir dele, junto com
`healthcheck.railway.app` -- o healthcheck bate com Host proprio, e fora da
lista ele levaria 400, marcaria o deploy como doente e derrubaria uma versao
que estava de pe.

Dominio proprio, ai sim e manual: ponha o seu em `ALLOWED_HOSTS` e
`CSRF_TRUSTED_ORIGINS`. O que vem do Railway continua valendo junto.

## Quando o migrate nao acha o banco

```
failed to resolve host 'postgres.railway.internal': Name or service not known
```

Esse erro quer dizer que a `DATABASE_URL` chegou e o Django tentou Postgres --
nao resolveu o nome, o que e outra coisa. As causas, em ordem de frequencia:

1. **O migrate esta rodando no build.** Se o traceback termina em
   `Build Failed` e a linha do comando aparece como
   `/bin/bash -ol pipefail -c python manage.py migrate`, nao e configuracao
   sua: e o Nixpacks. O `Dockerfile` deste repo existe para impedir isso --
   confirme que o builder do servico e Dockerfile, nao Nixpacks.
2. **A rede privada ainda nao subiu.** Ela leva alguns segundos depois do
   container, e o migrate roda logo no inicio. E para isso que existe o
   `esperar_banco` no preDeploy: ele tenta de novo com espera dobrada ate o
   banco responder.
3. **O Postgres nao esta no ar.** Veja o servico dele no painel: se o primeiro
   deploy falhou ou esta em pausa, nao existe nome para resolver.
4. **Ambiente ou projeto diferente.** O DNS `.railway.internal` so vale entre
   servicos do mesmo projeto *e* do mesmo ambiente. App em `production` e banco
   em outro ambiente nao se enxergam.
5. **Nome do servico trocado.** Se voce renomeou o Postgres, a referencia
   `${{Postgres.DATABASE_URL}}` aponta para um host que nao existe mais.

Rodar `railway run python manage.py migrate` da sua maquina da o mesmo erro, e
ai e esperado: `railway run` executa local, e `postgres.railway.internal` so
resolve de dentro da rede do Railway. Para conectar de fora use a
`DATABASE_PUBLIC_URL`.

## Qual branch publica

`deploy-railway` e a branch publicada; a `main` segue sendo onde o trabalho
acontece. No painel do Railway, a branch observada e `deploy-railway`.

Publicar, entao, e um merge consciente:

```bash
git switch deploy-railway
git merge main
git push
```

O push dispara o build, o migrate e o start. Nada vai para o celular sem esse
merge -- e a vantagem de separar: a `main` pode ficar quebrada no meio de uma
implementacao sem derrubar o app instalado.

Um detalhe do CI: o workflow dispara em push nas duas branches, mas o GitHub
le o arquivo da branch que recebeu o push. Enquanto `.github/` existir so em
`deploy-railway`, push na `main` nao roda a suite -- os PRs rodam. Se quiser a
`main` coberta tambem, leve so a pasta `.github/` para ela.

## Os dois discos

1. **Banco.** O sistema de arquivos da nuvem e efemero: o SQLite seria apagado
   em cada deploy. Crie o Postgres do provedor e deixe `DATABASE_URL` definida.
   O `settings.py` troca de banco sozinho quando ela existe.
2. **Anexos.** `arquivos/` tem o PDF e a imagem de cada topico, e sofre do mesmo
   problema. Monte um disco persistente e aponte `MEDIA_ROOT` para ele.

Para levar os dados que voce ja tem no SQLite local:

```bash
python manage.py dumpdata estudos --indent 2 > dados.json
```

E com as variaveis de producao apontando para o Postgres, depois do `migrate`:

```bash
python manage.py loaddata dados.json
```

## O que o iOS da e o que nao da

Com https valido e o app instalado na tela inicial: icone proprio, tela cheia
sem barra do Safari, os atalhos do `manifest.json` no toque longo do icone, e o
service worker registrado -- ou seja, funciona offline.

O que nao vem: **notificacao com o app fechado.** O `periodicSync` que
`static/js/comum.js` tenta registrar nao existe no Safari, e push de verdade
exigiria Web Push com chave VAPID no servidor. Hoje o lembrete aparece quando
voce abre o app.

## Se um dia precisar de portao

Nao ha autenticacao nem `CsrfViewMiddleware` no projeto -- os perfis sao so um
cookie dizendo quem esta usando, nao uma credencial. Num host local isso basta.
Numa URL publica significa que qualquer pessoa que descubra o endereco le e
altera seus estudos, e que outro site pode enviar POST em nome do seu navegador.

Caminhos, do mais simples ao mais correto:

1. **Nao expor.** Fique no tunel (`cloudflared tunnel --url http://localhost:8000`),
   que da URL https temporaria e so funciona com o PC ligado.
2. **Portao do provedor.** Cloudflare Access ou o basic auth do painel poem uma
   senha antes do app, sem tocar no codigo. Resolve o acesso; o CSRF continua
   em aberto, mas atras do portao o alcance e muito menor.
3. **Login no app.** `django.contrib.auth` + sessoes + `CsrfViewMiddleware` e
   `{% csrf_token %}` nos formularios. E a solucao de verdade, e o caminho mais
   longo: cada POST do app precisa passar a mandar o token.
