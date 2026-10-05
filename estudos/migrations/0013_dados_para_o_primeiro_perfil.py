"""Tudo o que existe passa a ser de um primeiro perfil.

O app rodou sem dono até aqui, então as linhas no banco não pertencem a
ninguém. Apagá-las e pedir para começar de novo seria perder um semestre de
sessões e a escada do SM-2 inteira -- então elas viram o perfil de quem já
estava usando, com um nome que dá para trocar na tela depois.

O perfil só é criado se houver o que mover: banco vazio continua vazio, e a
tela de escolha cuida do primeiro cadastro.
"""

from django.db import migrations

# Modelos que ganharam dono nesta leva.
COM_DONO = [
    "Configuracao",
    "Materia",
    "Topico",
    "Material",
    "Cartao",
    "Avaliacao",
    "SessaoEstudo",
    "BlocoPlanejado",
    "OcorrenciaPulada",
    "Revisao",
    "RespostaRevisao",
]

NOME_PADRAO = "Eu"


def existe_algum_dado(apps):
    return any(
        apps.get_model("estudos", nome).objects.exists() for nome in COM_DONO
    )


def adotar(apps, schema_editor):
    if not existe_algum_dado(apps):
        return

    Perfil = apps.get_model("estudos", "Perfil")
    perfil = Perfil.objects.create(nome=NOME_PADRAO, cor="#c2410c")

    for nome in COM_DONO:
        apps.get_model("estudos", nome).objects.filter(perfil__isnull=True).update(
            perfil=perfil
        )


def devolver(apps, schema_editor):
    """Volta as linhas para sem dono e apaga o perfil criado aqui."""
    for nome in COM_DONO:
        apps.get_model("estudos", nome).objects.update(perfil=None)
    apps.get_model("estudos", "Perfil").objects.filter(nome=NOME_PADRAO).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("estudos", "0012_perfis"),
    ]

    operations = [
        migrations.RunPython(adotar, devolver),
    ]
