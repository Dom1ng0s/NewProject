# Imagem propria em vez do Nixpacks: o detector de Django do Nixpacks injeta
# `python manage.py migrate` no build por conta dele, e no build nao existe
# rede privada -- o host postgres.railway.internal nao resolve ali de jeito
# nenhum. Era isso que derrubava o deploy. Aqui o build so instala e coleta;
# o migrate roda depois, no preDeployCommand do railway.json.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# As dependencias primeiro: assim o cache do pip sobrevive a mudanca de codigo.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Coleta no build, que e onde o disco e gravavel e o tempo nao conta para o
# healthcheck. Nao toca no banco: a chave falsa aqui so existe porque o
# settings exige alguma, e e descartada na proxima linha do deploy.
RUN SECRET_KEY=chave-de-build-descartavel DEBUG=0 ALLOWED_HOSTS=build \
    python manage.py collectstatic --noinput

# O Railway injeta PORT em tempo de execucao, entao a porta vai no shell form.
CMD gunicorn config.wsgi --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 60
