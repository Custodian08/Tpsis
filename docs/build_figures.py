# -*- coding: utf-8 -*-
"""BPMN-рисунки для пояснительной записки и плаката 6.1 (подписи на русском)."""
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Circle, Polygon, Rectangle
from matplotlib.lines import Line2D

OUT = Path(__file__).resolve().parent / "figures"
OUT.mkdir(parents=True, exist_ok=True)

plt.rcParams["font.family"] = "Times New Roman"
plt.rcParams["axes.unicode_minus"] = False


def _round_box(ax, x, y, w, h, text, fontsize=8):
    box = FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.02,rounding_size=0.12",
        linewidth=1.1, edgecolor="black", facecolor="white",
    )
    ax.add_patch(box)
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fontsize, wrap=True)
    return x + w, y + h / 2


def _circle(ax, x, y, r=0.22, thick=False):
    c = Circle((x, y), r, fill=False, linewidth=2.2 if thick else 1.2, edgecolor="black")
    ax.add_patch(c)
    return x, y


def _diamond(ax, x, y, w=0.7, h=0.55, text=""):
    pts = [(x, y + h / 2), (x + w / 2, y + h), (x + w, y + h / 2), (x + w / 2, y)]
    ax.add_patch(Polygon(pts, closed=True, fill=True, facecolor="white", edgecolor="black", linewidth=1.1))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=7)
    return x + w, y + h / 2


def _arrow(ax, x1, y1, x2, y2):
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="-|>", color="black", lw=1.05))


def _lane(ax, y, h, label, xmin, xmax):
    ax.add_patch(Rectangle((xmin, y), xmax - xmin, h, fill=False, linewidth=1.0, edgecolor="black"))
    ax.add_patch(Rectangle((xmin, y), 1.35, h, fill=True, facecolor="#eeeeee", edgecolor="black", linewidth=1.0))
    ax.text(xmin + 0.67, y + h / 2, label, ha="center", va="center", fontsize=8, rotation=90)


def draw_as_is(path: Path, figsize=(15.2, 8.4), dpi=180, title=None):
    fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
    ax.set_xlim(0, 16)
    ax.set_ylim(0, 9.2)
    ax.axis("off")
    if title:
        ax.text(8, 8.95, title, ha="center", va="top", fontsize=13, fontweight="bold")

    xmin, xmax = 0.25, 15.7
    lanes = [
        (6.15, 2.4, "Учетная\nсистема"),
        (3.65, 2.5, "Аналитик\nданных"),
        (1.15, 2.5, "Маркетолог"),
    ]
    pool_y, pool_h = 1.15, 7.4
    ax.add_patch(Rectangle((xmin, pool_y), xmax - xmin, pool_h, fill=False, lw=1.4))
    ax.text(0.12, pool_y + pool_h / 2, "Организация (как есть)", rotation=90,
            ha="center", va="center", fontsize=10, fontweight="bold")
    for y, h, name in lanes:
        _lane(ax, y, h, name, 0.45, xmax)

    # учетная система
    _circle(ax, 2.3, 7.35)
    ax.text(2.3, 7.72, "Начало", ha="center", fontsize=7)
    _round_box(ax, 3.0, 6.95, 2.4, 0.8, "Выгрузить\nпродажи")
    _arrow(ax, 2.52, 7.35, 3.0, 7.35)
    _arrow(ax, 5.4, 7.35, 5.4, 6.15)

    # аналитик
    _round_box(ax, 4.4, 5.15, 2.5, 0.85, "Очистить\nтаблицу")
    _diamond(ax, 7.2, 5.15, 1.15, 0.85, "Данные\nполные?")
    _round_box(ax, 8.7, 5.15, 2.45, 0.85, "Рассчитать\nR, F, M")
    _round_box(ax, 11.4, 5.15, 2.5, 0.85, "Проставить\nоценки 1–5")
    _arrow(ax, 6.9, 5.57, 7.2, 5.57)
    _arrow(ax, 8.35, 5.57, 8.7, 5.57)
    _arrow(ax, 11.15, 5.57, 11.4, 5.57)
    ax.text(7.75, 4.95, "нет: дозапрос", ha="center", fontsize=6.5)
    _arrow(ax, 7.75, 5.15, 7.75, 4.55)
    _arrow(ax, 7.75, 4.55, 5.65, 4.55)
    _arrow(ax, 5.65, 4.55, 5.65, 5.15)

    # маркетолог
    _round_box(ax, 4.3, 1.85, 2.6, 0.85, "Построить\nдиаграммы")
    _round_box(ax, 7.3, 1.85, 2.6, 0.85, "Сформировать\nотчет")
    _round_box(ax, 10.3, 1.85, 2.5, 0.85, "Согласовать\nрешения")
    _circle(ax, 13.55, 2.27, 0.22, thick=True)
    ax.text(13.55, 1.72, "Конец", ha="center", fontsize=7)
    _arrow(ax, 12.65, 5.57, 12.65, 2.7)
    _arrow(ax, 6.9, 2.27, 7.3, 2.27)
    _arrow(ax, 9.9, 2.27, 10.3, 2.27)
    _arrow(ax, 12.8, 2.27, 13.33, 2.27)
    _arrow(ax, 5.65, 5.15, 5.65, 2.7)

    ax.text(8.0, 0.55, "Рисунок — текущий процесс анализа клиентской базы", ha="center", fontsize=9)
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def draw_to_be(path: Path, figsize=(15.2, 9.6), dpi=180, title=None):
    fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
    ax.set_xlim(0, 16)
    ax.set_ylim(0, 11.0)
    ax.axis("off")
    if title:
        ax.text(8, 10.7, title, ha="center", va="top", fontsize=13, fontweight="bold")

    xmin, xmax = 0.2, 15.8
    ax.add_patch(Rectangle((xmin, 0.85), xmax - xmin, 9.55, fill=False, lw=1.4))
    ax.text(0.1, 5.6, "Целевой процесс", rotation=90, ha="center", va="center", fontsize=10, fontweight="bold")

    lanes = [
        (8.35, 2.0, "Интеллектуальный\nкомпонент"),
        (6.25, 2.1, "Серверный\nкомпонент"),
        (4.15, 2.1, "Клиентский\nкомпонент"),
        (2.05, 2.1, "Пользователь"),
    ]
    for y, h, name in lanes:
        _lane(ax, y, h, name, 0.42, xmax)

    # пользователь
    _circle(ax, 2.35, 3.1)
    ax.text(2.35, 3.48, "Начало", ha="center", fontsize=7)
    _round_box(ax, 2.85, 2.7, 2.15, 0.8, "Авторизоваться")
    _round_box(ax, 5.3, 2.7, 2.2, 0.8, "Загрузить\nданные")
    _round_box(ax, 7.8, 2.7, 2.2, 0.8, "Запустить\nанализ")
    _round_box(ax, 10.3, 2.7, 2.3, 0.8, "Изучить\nвизуализацию")
    _round_box(ax, 12.85, 2.7, 2.1, 0.8, "Выгрузить\nотчет")
    _circle(ax, 15.3, 3.1, 0.2, thick=True)
    ax.text(15.3, 2.55, "Конец", ha="center", fontsize=7)
    _arrow(ax, 2.57, 3.1, 2.85, 3.1)
    _arrow(ax, 5.0, 3.1, 5.3, 3.1)
    _arrow(ax, 7.5, 3.1, 7.8, 3.1)
    _arrow(ax, 10.0, 3.1, 10.3, 3.1)
    _arrow(ax, 12.6, 3.1, 12.85, 3.1)
    _arrow(ax, 14.95, 3.1, 15.1, 3.1)

    # клиент
    _round_box(ax, 5.25, 4.8, 2.3, 0.8, "Передать файл\nпо защищенному\nканалу")
    _round_box(ax, 10.25, 4.8, 2.4, 0.8, "Отобразить\nдиаграммы")
    _arrow(ax, 6.4, 3.5, 6.4, 4.8)
    _arrow(ax, 11.45, 4.8, 11.45, 3.5)

    # сервер
    _round_box(ax, 4.9, 7.0, 2.5, 0.85, "Проверить права\nи сохранить\nтранзакции")
    _round_box(ax, 7.7, 7.0, 2.55, 0.85, "Сформировать\nвитрину\nклиентских метрик")
    _round_box(ax, 10.55, 7.0, 2.5, 0.85, "Сохранить\nсегменты\nи отдать ответ")
    _arrow(ax, 6.4, 5.6, 6.15, 7.0)
    _arrow(ax, 7.4, 7.42, 7.7, 7.42)
    _arrow(ax, 10.25, 7.42, 10.55, 7.42)
    _arrow(ax, 11.8, 7.0, 11.45, 5.6)

    # интеллект
    _round_box(ax, 7.55, 9.0, 2.85, 0.9, "Рассчитать RFM,\nквантили и кластеры")
    _round_box(ax, 10.7, 9.0, 2.7, 0.9, "Сформировать\nрекомендации\nпо сегментам")
    _arrow(ax, 8.95, 7.85, 8.95, 9.0)
    _arrow(ax, 10.4, 9.45, 10.7, 9.45)
    _arrow(ax, 12.05, 9.0, 11.8, 7.85)

    ax.text(8.0, 0.35, "Паттерн интеграции: синхронный вызов интеллектуального микросервиса серверным компонентом",
            ha="center", fontsize=8)
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def draw_poster(path: Path):
    """Плакат А3 альбомный: два процесса."""
    fig = plt.figure(figsize=(16.54, 11.69), dpi=200)  # A3 inches
    fig.subplots_adjust(left=0.04, right=0.98, top=0.90, bottom=0.06, hspace=0.18)
    fig.text(0.5, 0.965, "Министерство образования Республики Беларусь", ha="center", fontsize=11)
    fig.text(0.5, 0.942, "УО «Белорусский государственный университет информатики и радиоэлектроники»",
             ha="center", fontsize=11)
    fig.text(0.5, 0.918, "BPMN-модель процессов предметной области", ha="center", fontsize=16, fontweight="bold")

    ax1 = fig.add_subplot(2, 1, 1)
    ax2 = fig.add_subplot(2, 1, 2)
    for ax in (ax1, ax2):
        ax.axis("off")

    # reuse drawing into existing axes is hard; save two images and paste
    tmp1 = OUT / "_tmp_as_is.png"
    tmp2 = OUT / "_tmp_to_be.png"
    draw_as_is(tmp1, figsize=(15.4, 7.6), dpi=160, title="а) текущий процесс («как есть»)")
    draw_to_be(tmp2, figsize=(15.4, 8.6), dpi=160, title="б) целевой процесс («как должно быть»)")
    plt.close("all")

    fig = plt.figure(figsize=(16.54, 11.69), dpi=200)
    fig.text(0.5, 0.97, "Министерство образования Республики Беларусь", ha="center", fontsize=12)
    fig.text(0.5, 0.948, "УО «Белорусский государственный университет информатики и радиоэлектроники»",
             ha="center", fontsize=12)
    fig.text(0.5, 0.922, "BPMN-модель процессов предметной области", ha="center", fontsize=18, fontweight="bold")
    fig.text(0.5, 0.898, "Проектирование и разработка программного средства анализа клиентской базы на основе RFM-анализа",
             ha="center", fontsize=11)

    img1 = plt.imread(tmp1)
    img2 = plt.imread(tmp2)
    ax1 = fig.add_axes([0.03, 0.48, 0.94, 0.40])
    ax2 = fig.add_axes([0.03, 0.07, 0.94, 0.40])
    ax1.imshow(img1)
    ax2.imshow(img2)
    ax1.axis("off")
    ax2.axis("off")
    fig.text(0.03, 0.025, "Плакат 6.1  ·  Формат А3  ·  Нотация BPMN 2.0  ·  Подписи на русском языке", fontsize=10)
    fig.text(0.97, 0.025, "Лист 1 из 1", ha="right", fontsize=10)
    fig.savefig(path, facecolor="white")
    plt.close(fig)
    tmp1.unlink(missing_ok=True)
    tmp2.unlink(missing_ok=True)


if __name__ == "__main__":
    draw_as_is(OUT / "fig_1_1_bpmn_as_is.png", title=None)
    draw_to_be(OUT / "fig_2_1_bpmn_to_be.png", title=None)
    draw_poster(OUT / "plakat_6_1_bpmn_a3.png")
    print("OK", OUT)
