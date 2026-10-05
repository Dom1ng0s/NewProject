# O Railway le railway.json, nao este arquivo -- em especial, ele ignora a
# linha release: do Heroku, e por isso o migrate mora no preDeployCommand de
# la. O Procfile fica para quem rodar o app em Heroku ou Dokku.
release: python manage.py migrate --noinput
web: gunicorn config.wsgi --bind 0.0.0.0:$PORT --workers 2 --timeout 60
