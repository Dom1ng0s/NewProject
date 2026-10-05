"""Espera o banco aceitar conexao antes de seguir.

A rede privada do Railway nao sobe junto com o container: por alguns segundos
`postgres.railway.internal` ainda nao resolve, e quem tentar conectar nesse
intervalo leva um "Name or service not known" -- que parece banco errado, mas e
so pressa. O migrate roda logo no inicio do deploy, exatamente na janela ruim.

Entao o deploy chama este comando antes: ele tenta, espera, tenta de novo, e so
desiste depois do prazo. Falhar aqui, com a mensagem clara, e melhor que falhar
no migrate com vinte linhas de traceback.

    python manage.py esperar_banco [--prazo 60]
"""

import time

from django.core.management.base import BaseCommand, CommandError
from django.db import connections
from django.db.utils import OperationalError


class Command(BaseCommand):
    help = "Espera o banco responder, para o migrate nao correr na frente da rede."

    def add_arguments(self, parser):
        parser.add_argument(
            "--prazo",
            type=float,
            default=60,
            help="segundos de tentativa antes de desistir (padrao: 60)",
        )
        parser.add_argument(
            "--banco",
            default="default",
            help="qual conexao esperar (padrao: default)",
        )

    def handle(self, *args, **opcoes):
        conexao = connections[opcoes["banco"]]
        limite = time.monotonic() + opcoes["prazo"]
        espera = 1.0
        ultimo_erro = None
        tentativas = 0

        while True:
            tentativas += 1
            try:
                # Fecha antes de tentar: uma conexao morta fica em cache e o
                # ensure_connection seguinte devolveria o mesmo erro de novo.
                conexao.close()
                conexao.ensure_connection()
            except OperationalError as erro:
                ultimo_erro = erro
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"banco respondeu ({conexao.vendor}) na tentativa {tentativas}"
                    )
                )
                return

            if time.monotonic() + espera >= limite:
                raise CommandError(
                    f"o banco nao respondeu em {opcoes['prazo']:.0f}s "
                    f"({tentativas} tentativas). Ultimo erro: {ultimo_erro}"
                )

            self.stdout.write(f"banco ainda nao respondeu, tentando em {espera:.0f}s")
            time.sleep(espera)
            # Dobra a espera, com teto: a rede privada leva segundos, nao
            # minutos; se passar disso o problema nao e tempo.
            espera = min(espera * 2, 8.0)
