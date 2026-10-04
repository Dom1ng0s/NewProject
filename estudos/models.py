from datetime import timedelta

from django.db import models
from django.utils import timezone


class Configuracao(models.Model):
    """Os ajustes do app, numa linha so.

    Moravam em `settings.py`, o que obrigava a editar codigo para mudar a meta
    da semana. Aqui ficam no banco, viram tela e entram no backup. E um
    singleton: sempre a linha de id 1.
    """

    # repeticao espacada
    primeiro_intervalo_dias = models.PositiveSmallIntegerField(default=1)
    segundo_intervalo_dias = models.PositiveSmallIntegerField(default=6)
    facilidade_minima = models.FloatField(default=1.3)
    intervalo_maximo_dias = models.PositiveSmallIntegerField(default=365)
    maximo_revisoes_por_dia = models.PositiveSmallIntegerField(
        default=10, help_text="0 = sem teto"
    )

    # metas e avisos
    meta_horas_semanais = models.FloatField(default=10)
    dias_materia_parada = models.PositiveSmallIntegerField(default=7)
    dias_proximas_avaliacoes = models.PositiveSmallIntegerField(default=30)

    # pomodoro
    pomodoro_foco_min = models.PositiveSmallIntegerField(default=25)
    pomodoro_pausa_min = models.PositiveSmallIntegerField(default=5)
    pomodoro_pausa_longa_min = models.PositiveSmallIntegerField(default=15)
    pomodoro_ciclos = models.PositiveSmallIntegerField(default=4)

    class Meta:
        verbose_name = "configuração"

    def __str__(self):
        return "Configuração"

    @classmethod
    def atual(cls):
        config, _ = cls.objects.get_or_create(pk=1)
        return config

    def save(self, *args, **kwargs):
        self.pk = 1  # nunca existe uma segunda linha
        super().save(*args, **kwargs)

    def json(self):
        campos = [c.name for c in self._meta.fields if c.name != "id"]
        return {nome: getattr(self, nome) for nome in campos}


class Materia(models.Model):
    """Subject."""

    nome = models.CharField(max_length=80, unique=True)
    cor = models.CharField(max_length=7, default="#4f8cff")
    meta_horas_semanais = models.FloatField(default=0)
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nome"]

    def __str__(self):
        return self.nome

    def json(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "cor": self.cor,
            "meta_horas_semanais": self.meta_horas_semanais,
        }


def dia_com_vaga(data, limite, topico=None, tentativas=365):
    """Primeiro dia a partir de `data` com menos de `limite` revisoes marcadas.

    `limite` 0 desliga o teto. O proprio topico nao conta como ocupante: ele
    esta sendo reagendado, nao somado.
    """
    if not limite:
        return data
    for _ in range(tentativas):
        ocupadas = Revisao.objects.filter(data_prevista=data, feita=False)
        if topico is not None:
            ocupadas = ocupadas.exclude(topico=topico)
        if ocupadas.count() < limite:
            return data
        data += timedelta(days=1)
    return data


class Topico(models.Model):
    """Topic: arvore de ate 3 niveis via `pai` (materia > assunto > subtopico)."""

    NAO_INICIADO = "nao_iniciado"
    ESTUDANDO = "estudando"
    REVISADO = "revisado"
    DOMINADO = "dominado"
    STATUS = [
        (NAO_INICIADO, "Não iniciado"),
        (ESTUDANDO, "Estudando"),
        (REVISADO, "Revisado"),
        (DOMINADO, "Dominado"),
    ]

    materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name="topicos")
    pai = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="filhos"
    )
    nome = models.CharField(max_length=140)
    status = models.CharField(max_length=20, choices=STATUS, default=NAO_INICIADO)
    notas = models.TextField(blank=True, help_text="resumo livre do topico")
    criado_em = models.DateTimeField(auto_now_add=True)

    # Estado do SM-2. `facilidade` cresce quando o topico sai facil e encolhe
    # quando custa; `intervalo_dias` e o ultimo intervalo usado, e `acertos
    # seguidos` zera a cada erro -- e o que faz a escada recomecar do primeiro
    # degrau em vez de continuar de onde parou.
    facilidade = models.FloatField(default=2.5)
    intervalo_dias = models.PositiveIntegerField(default=0)
    acertos_seguidos = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["nome"]

    def __str__(self):
        return f"{self.materia.nome} / {self.nome}"

    @property
    def nivel(self):
        return 1 if self.pai_id is None else (2 if self.pai.pai_id is None else 3)

    def json(self):
        return {
            "id": self.id,
            "materia_id": self.materia_id,
            "pai_id": self.pai_id,
            "nome": self.nome,
            "status": self.status,
            "notas": self.notas,
            "facilidade": self.facilidade,
            "intervalo_dias": self.intervalo_dias,
            "acertos_seguidos": self.acertos_seguidos,
        }

    @property
    def tem_cartoes(self):
        return self.cartoes.exists()

    def agendar(self, dias, qualidade=None):
        """Marca a proxima revisao daqui a `dias`, sem criar duas para o mesmo dia.

        Se o dia ja estiver cheio, escorrega para o proximo com vaga: um domingo
        de cadastro em massa nao pode virar uma terca impossivel, e um dia
        impossivel e um dia pulado, que derruba a escada de todos de uma vez.
        """
        config = Configuracao.atual()
        data = timezone.localdate() + timedelta(days=max(dias, 0))
        data = dia_com_vaga(data, config.maximo_revisoes_por_dia, self)
        revisao, nova = Revisao.objects.get_or_create(
            topico=self, data_prevista=data, feita=False, defaults={"qualidade": qualidade}
        )
        return revisao if nova else None

    def iniciar_revisoes(self):
        """Primeira revisao de um topico recem-estudado.

        So agenda se o topico ainda nao tem revisao pendente: estudar de novo no
        meio da escada nao pode jogar a revisao de volta para o primeiro degrau.
        """
        if Revisao.objects.filter(topico=self, feita=False).exists():
            return None
        primeiro = Configuracao.atual().primeiro_intervalo_dias
        if self.acertos_seguidos == 0 and self.intervalo_dias == 0:
            self.intervalo_dias = primeiro
            self.save(update_fields=["intervalo_dias"])
        return self.agendar(self.intervalo_dias or primeiro)

    def responder(self, qualidade):
        """Aplica o SM-2 e agenda a proxima revisao. Devolve a revisao criada.

        `qualidade` vai de 0 (errei) a 5 (facil), como no SM-2 original. Abaixo
        de 3 a escada recomeca; de 3 para cima o intervalo cresce multiplicado
        pela facilidade, que por sua vez sobe ou desce conforme a resposta.
        """
        qualidade = max(0, min(int(qualidade), 5))
        config = Configuracao.atual()

        if qualidade < 3:
            self.acertos_seguidos = 0
            self.intervalo_dias = config.primeiro_intervalo_dias
        else:
            self.acertos_seguidos += 1
            if self.acertos_seguidos == 1:
                self.intervalo_dias = config.primeiro_intervalo_dias
            elif self.acertos_seguidos == 2:
                self.intervalo_dias = config.segundo_intervalo_dias
            else:
                self.intervalo_dias = max(
                    round(self.intervalo_dias * self.facilidade), self.intervalo_dias + 1
                )

        # Formula do SM-2: so o acerto folgado (5) aumenta a facilidade.
        ajuste = 0.1 - (5 - qualidade) * (0.08 + (5 - qualidade) * 0.02)
        self.facilidade = max(round(self.facilidade + ajuste, 3), config.facilidade_minima)
        self.intervalo_dias = min(self.intervalo_dias, config.intervalo_maximo_dias)
        self.save(update_fields=["facilidade", "intervalo_dias", "acertos_seguidos"])

        return self.agendar(self.intervalo_dias, qualidade=qualidade)


class Material(models.Model):
    """Onde o assunto foi estudado: um link, um PDF, a pagina do livro.

    O tipo nao e um campo: e link quando tem `url` e arquivo quando tem
    `arquivo` -- guardar os dois seria inventar um estado que nao existe.
    """

    topico = models.ForeignKey(
        Topico, on_delete=models.CASCADE, related_name="materiais"
    )
    titulo = models.CharField(max_length=160)
    url = models.URLField(max_length=500, blank=True)
    arquivo = models.FileField(upload_to="materiais/", blank=True)
    nota = models.CharField(max_length=200, blank=True, help_text="página, capítulo…")
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criado_em"]

    def __str__(self):
        return self.titulo

    @property
    def tipo(self):
        return "arquivo" if self.arquivo else "link"

    @property
    def endereco(self):
        return self.arquivo.url if self.arquivo else self.url

    def json(self):
        return {
            "id": self.id,
            "topico_id": self.topico_id,
            "titulo": self.titulo,
            "tipo": self.tipo,
            "endereco": self.endereco,
            "nota": self.nota,
            "nome_do_arquivo": self.arquivo.name.split("/")[-1] if self.arquivo else "",
        }


class Cartao(models.Model):
    """O que se tenta lembrar na revisao: uma pergunta e a resposta.

    Sem isto a revisao e so um lembrete de que o topico existe -- o efeito de
    teste vem de tentar lembrar antes de ver a resposta.
    """

    topico = models.ForeignKey(Topico, on_delete=models.CASCADE, related_name="cartoes")
    frente = models.TextField()
    verso = models.TextField()
    ordem = models.PositiveIntegerField(default=0)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["ordem", "id"]

    def __str__(self):
        return self.frente[:40]

    def json(self):
        return {
            "id": self.id,
            "topico_id": self.topico_id,
            "frente": self.frente,
            "verso": self.verso,
            "ordem": self.ordem,
        }


class Avaliacao(models.Model):
    """Prova, trabalho ou entrega com data marcada.

    E o que da urgencia ao resto: sem uma data de prova, o app so sabe ordenar
    revisao por "venceu hoje". Os topicos ligados aqui sao o conteudo que cai.
    """

    PROVA = "prova"
    TRABALHO = "trabalho"
    OUTRO = "outro"
    TIPOS = [(PROVA, "Prova"), (TRABALHO, "Trabalho"), (OUTRO, "Outro")]

    materia = models.ForeignKey(
        Materia, on_delete=models.CASCADE, related_name="avaliacoes"
    )
    topicos = models.ManyToManyField(Topico, blank=True, related_name="avaliacoes")
    tipo = models.CharField(max_length=10, choices=TIPOS, default=PROVA)
    titulo = models.CharField(max_length=120)
    descricao = models.TextField(blank=True)
    data = models.DateField()
    hora = models.TimeField(null=True, blank=True)
    peso = models.FloatField(default=0, help_text="peso na media; 0 = nao informado")
    nota = models.FloatField(null=True, blank=True)
    concluida = models.BooleanField(default=False)
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["data", "hora"]

    def __str__(self):
        return f"{self.titulo} ({self.data:%d/%m})"

    @property
    def dias_restantes(self):
        return (self.data - timezone.localdate()).days

    def json(self, topicos=None):
        """`topicos` evita uma consulta por avaliacao quando a lista e grande."""
        if topicos is None:
            topicos = list(self.topicos.all())
        dias = self.dias_restantes
        return {
            "id": self.id,
            "materia_id": self.materia_id,
            "materia": self.materia.nome,
            "cor": self.materia.cor,
            "tipo": self.tipo,
            "titulo": self.titulo,
            "descricao": self.descricao,
            "data": self.data.isoformat(),
            "hora": self.hora.strftime("%H:%M") if self.hora else "",
            "peso": self.peso,
            "nota": self.nota,
            "concluida": self.concluida,
            "dias": dias,
            "passou": dias < 0,
            "topicos": [{"id": t.id, "nome": t.nome} for t in topicos],
        }


class SessaoEstudo(models.Model):
    """StudySession."""

    topico = models.ForeignKey(Topico, on_delete=models.CASCADE, related_name="sessoes")
    inicio = models.DateTimeField(default=timezone.now)
    duracao_min = models.PositiveIntegerField(default=0)
    nota = models.TextField(blank=True)
    # Quantas vezes o foco foi quebrado. O numero sozinho ja diz muito sobre
    # onde a hora foi parar -- uma sessao de 50 min com 9 interrupcoes nao e a
    # mesma coisa que uma de 50 min inteiricas.
    interrupcoes = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["-inicio"]

    def json(self):
        return {
            "id": self.id,
            "topico_id": self.topico_id,
            "topico": self.topico.nome,
            "materia_id": self.topico.materia_id,
            "materia": self.topico.materia.nome,
            "cor": self.topico.materia.cor,
            "inicio": timezone.localtime(self.inicio).isoformat(timespec="minutes"),
            "duracao_min": self.duracao_min,
            "nota": self.nota,
            "interrupcoes": self.interrupcoes,
        }


class BlocoPlanejado(models.Model):
    """PlannedBlock: dia da semana 0=segunda ... 6=domingo.

    `semana` nula marca um bloco recorrente, que aparece em todas as semanas
    (aula fixa, academia). Com data, vale so naquela semana.
    """

    AULA = "aula"
    ESTUDO = "estudo"
    OUTRO = "outro"
    TIPOS = [(AULA, "Aula"), (ESTUDO, "Estudo"), (OUTRO, "Outro")]

    tipo = models.CharField(max_length=10, choices=TIPOS, default=ESTUDO)
    titulo = models.CharField(max_length=120, blank=True)
    descricao = models.TextField(blank=True)
    materia = models.ForeignKey(
        Materia, null=True, blank=True, on_delete=models.CASCADE, related_name="blocos"
    )
    topico = models.ForeignKey(
        Topico, null=True, blank=True, on_delete=models.SET_NULL, related_name="blocos"
    )
    semana = models.DateField(
        null=True, blank=True, help_text="segunda-feira da semana; vazio = toda semana"
    )
    dia_semana = models.PositiveSmallIntegerField()
    hora_inicio = models.TimeField()
    hora_fim = models.TimeField()

    class Meta:
        ordering = ["dia_semana", "hora_inicio"]

    def __str__(self):
        return f"{self.rotulo} ({self.hora_inicio:%H:%M})"

    @property
    def recorrente(self):
        return self.semana is None

    @property
    def rotulo(self):
        return self.titulo or (self.materia.nome if self.materia else "Sem título")

    @property
    def duracao_min(self):
        i = self.hora_inicio.hour * 60 + self.hora_inicio.minute
        f = self.hora_fim.hour * 60 + self.hora_fim.minute
        return max(f - i, 0)

    def json(self, semana=None, pulado=False):
        return {
            "id": self.id,
            "tipo": self.tipo,
            "titulo": self.titulo,
            "descricao": self.descricao,
            "rotulo": self.rotulo,
            "materia_id": self.materia_id,
            "materia": self.materia.nome if self.materia else "",
            "cor": self.materia.cor if self.materia else "#8b93a7",
            "topico_id": self.topico_id,
            "topico": self.topico.nome if self.topico else "",
            "recorrente": self.recorrente,
            "pulado": pulado,
            "semana": (semana or self.semana).isoformat() if (semana or self.semana) else None,
            "dia_semana": self.dia_semana,
            "hora_inicio": self.hora_inicio.strftime("%H:%M"),
            "hora_fim": self.hora_fim.strftime("%H:%M"),
            "inicio_min": self.hora_inicio.hour * 60 + self.hora_inicio.minute,
            "duracao_min": self.duracao_min,
        }


class OcorrenciaPulada(models.Model):
    """Uma semana em que um bloco recorrente nao acontece (feriado, aula cancelada)."""

    bloco = models.ForeignKey(
        BlocoPlanejado, on_delete=models.CASCADE, related_name="puladas"
    )
    semana = models.DateField()

    class Meta:
        unique_together = [("bloco", "semana")]


class Revisao(models.Model):
    """Review."""

    topico = models.ForeignKey(Topico, on_delete=models.CASCADE, related_name="revisoes")
    data_prevista = models.DateField()
    feita = models.BooleanField(default=False)
    dificil = models.BooleanField(default=False)
    feita_em = models.DateTimeField(null=True, blank=True)
    qualidade = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text="0 a 5, a nota que o SM-2 recebeu"
    )

    class Meta:
        ordering = ["data_prevista"]

    def json(self, cartoes=None):
        """`cartoes` evita uma consulta por revisao quando a fila e longa."""
        hoje = timezone.localdate()
        return {
            "id": self.id,
            "topico_id": self.topico_id,
            "topico": self.topico.nome,
            "materia": self.topico.materia.nome,
            "cor": self.topico.materia.cor,
            "data_prevista": self.data_prevista.isoformat(),
            "atrasada": (not self.feita) and self.data_prevista < hoje,
            "feita": self.feita,
            "dificil": self.dificil,
            "qualidade": self.qualidade,
            "cartoes": self.topico.cartoes.count() if cartoes is None else cartoes,
        }


class RespostaRevisao(models.Model):
    """Uma resposta dada numa revisao, guardada para sempre.

    `Revisao` guarda o estado atual e o topico guarda a facilidade de agora --
    os dois sao uma fotografia do presente. Sem este log nao existe "os topicos
    que eu acho que sei e nao sei", porque ninguem lembra que errou o mesmo
    assunto tres vezes em maio.

    Guarda tambem o estado do topico imediatamente antes da resposta, que e o
    que permite desfazer uma nota dada por engano.
    """

    topico = models.ForeignKey(
        Topico, on_delete=models.CASCADE, related_name="respostas"
    )
    # A revisao pode ser apagada depois (substituir no backup, por exemplo); o
    # log sobrevive, porque o que interessa e a resposta, nao a linha da fila.
    revisao = models.ForeignKey(
        Revisao, null=True, blank=True, on_delete=models.SET_NULL, related_name="respostas"
    )
    qualidade = models.PositiveSmallIntegerField(help_text="0 a 5, a nota do SM-2")
    respondida_em = models.DateTimeField(default=timezone.now)
    data_prevista = models.DateField(help_text="o dia para que a revisao estava marcada")
    atraso_dias = models.PositiveSmallIntegerField(
        default=0, help_text="dias entre o previsto e o respondido"
    )

    # estado do topico antes da resposta -- o que desfazer devolve
    status_antes = models.CharField(max_length=20)
    facilidade_antes = models.FloatField()
    intervalo_antes = models.PositiveIntegerField()
    acertos_antes = models.PositiveIntegerField()

    # e depois, para a escada ser legivel sem recalcular o SM-2 de tras para frente
    facilidade_depois = models.FloatField()
    intervalo_depois = models.PositiveIntegerField()

    class Meta:
        ordering = ["-respondida_em", "-id"]
        verbose_name = "resposta de revisão"
        verbose_name_plural = "respostas de revisão"

    def __str__(self):
        return f"{self.topico.nome}: {self.qualidade}"

    @property
    def acertou(self):
        return self.qualidade >= 3

    def json(self):
        return {
            "id": self.id,
            "topico_id": self.topico_id,
            "topico": self.topico.nome,
            "materia": self.topico.materia.nome,
            "cor": self.topico.materia.cor,
            "qualidade": self.qualidade,
            "acertou": self.acertou,
            "respondida_em": timezone.localtime(self.respondida_em).isoformat(
                timespec="minutes"
            ),
            "data_prevista": self.data_prevista.isoformat(),
            "atraso_dias": self.atraso_dias,
            "facilidade_antes": self.facilidade_antes,
            "facilidade_depois": self.facilidade_depois,
            "intervalo_antes": self.intervalo_antes,
            "intervalo_depois": self.intervalo_depois,
        }
