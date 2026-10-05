from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("estudos", "0010_respostarevisao"),
    ]

    operations = [
        migrations.AddField(
            model_name="configuracao",
            name="folgas_por_semana",
            field=models.PositiveSmallIntegerField(
                default=1,
                help_text="dias que a sequência perdoa por semana; 0 = nenhum",
            ),
        ),
    ]
