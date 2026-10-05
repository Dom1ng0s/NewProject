"""De quem é a linha: o perfil atual, e o manager que filtra por ele.

O app nasceu de uma pessoa só, então nenhuma tabela tinha dono. Pôr perfis
significa que toda consulta precisa saber de quem é o dado -- e são mais de cem
consultas. Escrever `.filter(perfil=...)` em cada uma seria garantir que um dia
alguém esquece uma, e uma consulta esquecida não quebra nada: ela mostra a
matéria de outra pessoa, calada.

Então o filtro é o padrão, não a exceção. O perfil atual mora num ContextVar
que o middleware preenche a cada request, e o manager de todo modelo com dono
já nasce filtrado. Para ver tudo é preciso dizer isso em voz alta
(`Modelo.de_todos_os_perfis()`), e os dois lugares que precisam -- o backup e a
migração -- dizem.

ContextVar e não thread-local: o `runserver` serve em threads, mas o padrão
também vale sob async sem um perfil vazar de um request para o outro.
"""

from contextlib import contextmanager
from contextvars import ContextVar

from django.db import models

# None = sem perfil definido: fora de um request (shell, migração, teste que
# não quis saber de perfil). Nesse caso o manager não filtra, porque filtrar
# por "ninguém" devolveria nada e transformaria todo script em um mistério.
_perfil = ContextVar("perfil_atual", default=None)


def definir(perfil):
    """Marca de quem são as consultas daqui para a frente. Devolve o token."""
    return _perfil.set(perfil)


def restaurar(token):
    _perfil.reset(token)


def atual():
    return _perfil.get()


def atual_id():
    perfil = _perfil.get()
    return perfil.id if perfil else None


@contextmanager
def como(perfil):
    """Roda um trecho como outro perfil (ou como nenhum, com `None`)."""
    token = definir(perfil)
    try:
        yield perfil
    finally:
        restaurar(token)


class PorPerfil(models.Manager):
    """Manager que só enxerga as linhas do perfil atual.

    É o manager padrão (`objects`) dos modelos com dono. Sem perfil definido
    ele não filtra -- ver o comentário do `_perfil`.
    """

    def get_queryset(self):
        consulta = super().get_queryset()
        perfil_id = atual_id()
        return consulta if perfil_id is None else consulta.filter(perfil_id=perfil_id)


class ComDono(models.Model):
    """Base dos modelos que pertencem a um perfil.

    O `perfil` se preenche sozinho no `save()`: nos modelos-raiz, a partir do
    perfil atual; nos que têm pai (um cartão é do tópico, um tópico é da
    matéria), a partir do pai. Deixar isso para quem chama seria o mesmo
    esquecimento de antes, com outro nome.
    """

    # De onde herdar o dono quando o modelo tem pai. "topico", "materia"…
    dono_vem_de = None

    perfil = models.ForeignKey(
        "estudos.Perfil", on_delete=models.CASCADE, related_name="+"
    )

    objects = PorPerfil()
    # A porta de saída, para quem precisa de verdade ver tudo.
    todos = models.Manager()

    class Meta:
        abstract = True
        base_manager_name = "todos"

    @classmethod
    def de_todos_os_perfis(cls):
        return cls.todos.all()

    def save(self, *args, **kwargs):
        if self.perfil_id is None:
            self.perfil_id = self._dono_herdado()
        super().save(*args, **kwargs)

    def _dono_herdado(self):
        if self.dono_vem_de:
            pai = getattr(self, self.dono_vem_de, None)
            if pai is not None:
                return pai.perfil_id
        perfil_id = atual_id()
        if perfil_id is None:
            raise ValueError(
                f"{type(self).__name__} sem perfil: defina o perfil atual "
                "(estudos.escopo.definir) ou passe perfil= ao criar."
            )
        return perfil_id
