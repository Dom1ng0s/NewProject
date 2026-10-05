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
| `ALLOWED_HOSTS` | sim | o dominio, ex. `estudos.exemplo.com` |
| `CSRF_TRUSTED_ORIGINS` | sim | o mesmo dominio com esquema: `https://estudos.exemplo.com` |
| `DATABASE_URL` | sim | Postgres. O provedor costuma injetar ao criar o banco |
| `MEDIA_ROOT` | se usa anexos | caminho de um disco persistente, ex. `/dados/arquivos` |
| `SECURE_SSL_REDIRECT` | nao | `1` por padrao; desligue so se o provedor ja forca https |

Gerar a chave:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## Deploy automatico

`railway.json` descreve build, migrate e start, entao nao ha campo para
preencher no painel: o Railway le o arquivo a cada push na branch que ele
observa e publica sozinho.

- build: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
- preDeploy: `python manage.py migrate --noinput`
- start: `gunicorn config.wsgi --bind 0.0.0.0:$PORT --workers 2 --timeout 60`
- healthcheck: `/perfis/`, que responde 200 sem depender de cookie

O `migrate` fica em `preDeployCommand` de proposito: o Railway **ignora** a
linha `release:` do Procfile, que e convencao do Heroku. Se ele mudar de lugar,
o banco para de acompanhar o codigo sem ninguem avisar.

O healthcheck aponta para `/perfis/` e nao para `/`, porque `/` responde 302
para la quando nao ha perfil escolhido.

No painel do Railway, uma vez: ligar o repo, escolher a branch observada e
criar o Postgres como servico. O resto e push.

`.github/workflows/testes.yml` roda a suite, confere se falta migration e
valida a configuracao de producao em cada push e PR. Nao e ele que publica --
isso e o Railway -- mas e o que faz o commit quebrado aparecer marcado no
GitHub antes de voce notar pelo celular.

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
