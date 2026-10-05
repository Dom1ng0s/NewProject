"""O dono passa a ser obrigatorio.

A migracao anterior ja deu dono a tudo o que existia; aqui a coluna deixa de
aceitar nulo, para nao nascer linha orfa depois. Sem dono obrigatorio, uma
consulta filtrada por perfil simplesmente nao enxergaria a linha -- ela sumiria
da tela sem erro nenhum, que e o pior jeito de perder dado.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("estudos", "0013_dados_para_o_primeiro_perfil"),
    ]

    operations = [
        migrations.AlterField(
            model_name="avaliacao",
            name="perfil",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="estudos.perfil",
            ),
        ),
        migrations.AlterField(
            model_name="blocoplanejado",
            name="perfil",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="estudos.perfil",
            ),
        ),
        migrations.AlterField(
            model_name="cartao",
            name="perfil",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="estudos.perfil",
            ),
        ),
        migrations.AlterField(
            model_name="configuracao",
            name="perfil",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="estudos.perfil",
            ),
        ),
        migrations.AlterField(
            model_name="materia",
            name="perfil",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="estudos.perfil",
            ),
        ),
        migrations.AlterField(
            model_name="material",
            name="perfil",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="estudos.perfil",
            ),
        ),
        migrations.AlterField(
            model_name="ocorrenciapulada",
            name="perfil",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="estudos.perfil",
            ),
        ),
        migrations.AlterField(
            model_name="respostarevisao",
            name="perfil",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="estudos.perfil",
            ),
        ),
        migrations.AlterField(
            model_name="revisao",
            name="perfil",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="estudos.perfil",
            ),
        ),
        migrations.AlterField(
            model_name="sessaoestudo",
            name="perfil",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="estudos.perfil",
            ),
        ),
        migrations.AlterField(
            model_name="topico",
            name="perfil",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="estudos.perfil",
            ),
        ),
    ]
