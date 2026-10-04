"""Deixa uma revisao pendente por topico.

O agendamento antigo criava quatro datas de uma vez (1, 7, 15 e 30 dias). Com o
SM-2 cada revisao agenda a seguinte, uma de cada vez, entao as datas que sobraram
do esquema antigo fariam o mesmo topico aparecer varias vezes na fila. Fica a
mais proxima; as outras sao apagadas. Revisao ja feita nao e tocada -- e historico.
"""

from django.db import migrations


def manter_a_mais_proxima(apps, schema_editor):
    Revisao = apps.get_model("estudos", "Revisao")
    vistos = set()
    sobrando = []
    for revisao in Revisao.objects.filter(feita=False).order_by("topico_id", "data_prevista"):
        if revisao.topico_id in vistos:
            sobrando.append(revisao.pk)
        else:
            vistos.add(revisao.topico_id)
    Revisao.objects.filter(pk__in=sobrando).delete()


def nao_desfaz(apps, schema_editor):
    """As revisoes apagadas nao voltam -- e o estudo que reagenda a proxima."""


class Migration(migrations.Migration):
    dependencies = [("estudos", "0005_revisao_qualidade_topico_acertos_seguidos_and_more")]

    operations = [migrations.RunPython(manter_a_mais_proxima, nao_desfaz)]
