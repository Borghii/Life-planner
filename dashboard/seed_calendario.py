"""
Script one-time: carga feriados nacionales 2026, asuetos académicos UCEL
y fechas clave del Calendario Académico 2026 como recordatorios.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")

EVENTOS = [
    # ── FERIADOS NACIONALES 2026 ────────────────────────────────────────────────
    ("2026-01-01", "🇦🇷 Año Nuevo"),
    ("2026-02-16", "🎉 Carnaval"),
    ("2026-02-17", "🎉 Carnaval"),
    ("2026-03-24", "🇦🇷 Día de la Memoria por la Verdad y la Justicia"),
    ("2026-04-02", "🇦🇷 Día del Veterano y los Caídos en Malvinas"),
    ("2026-04-03", "✝️ Viernes Santo"),
    ("2026-05-01", "🇦🇷 Día del Trabajador"),
    ("2026-05-25", "🇦🇷 Revolución de Mayo"),
    ("2026-06-15", "🇦🇷 Paso a la Inmortalidad del Gral. Belgrano"),
    ("2026-07-09", "🇦🇷 Día de la Independencia"),
    ("2026-08-17", "🇦🇷 Paso a la Inmortalidad del Gral. San Martín"),
    ("2026-10-12", "🇦🇷 Día del Respeto a la Diversidad Cultural"),
    ("2026-11-23", "🇦🇷 Día de la Soberanía Nacional"),
    ("2026-12-08", "✝️ Inmaculada Concepción de María"),
    ("2026-12-25", "🎄 Navidad"),

    # ── ASUETO ACADÉMICO UCEL (marcados en el calendario) ─────────────────────
    # Receso invernal entre cuatrimestres (semanas del 6 al 17 de julio)
    ("2026-07-06", "🏫 Asueto académico UCEL"),
    ("2026-07-07", "🏫 Asueto académico UCEL"),
    ("2026-07-08", "🏫 Asueto académico UCEL"),
    ("2026-07-10", "🏫 Asueto académico UCEL"),
    ("2026-07-13", "🏫 Asueto académico UCEL"),
    ("2026-07-14", "🏫 Asueto académico UCEL"),
    ("2026-07-15", "🏫 Asueto académico UCEL"),
    ("2026-07-16", "🏫 Asueto académico UCEL"),
    ("2026-07-17", "🏫 Asueto académico UCEL"),

    # ── CURSADA ─────────────────────────────────────────────────────────────────
    ("2026-03-09", "📚 Inicio cursada 1° cuatrimestre"),
    ("2026-06-19", "📚 Fin cursada 1° cuatrimestre"),
    ("2026-08-03", "📚 Inicio cursada 2° cuatrimestre"),
    ("2026-11-19", "📚 Fin cursada 2° cuatrimestre"),

    # ── INSCRIPCIONES ───────────────────────────────────────────────────────────
    ("2026-02-02", "📝 Apertura inscripción 1° cuatrimestre (autogestión)"),
    ("2026-03-16", "📝 Cierre inscripción 1° cuatrimestre (autogestión)"),
    ("2026-03-17", "📝 Apertura inscripción 1° cuatrimestre (fuera de término)"),
    ("2026-03-31", "📝 Cierre inscripción 1° cuatrimestre (fuera de término)"),
    ("2026-07-06", "📝 Apertura inscripción 2° cuatrimestre (autogestión)"),
    ("2026-08-07", "📝 Cierre inscripción 2° cuatrimestre (autogestión)"),
    ("2026-08-08", "📝 Apertura inscripción 2° cuatrimestre (fuera de término)"),
    ("2026-08-31", "📝 Cierre inscripción 2° cuatrimestre (fuera de término)"),

    # ── TURNOS DE EXÁMENES ──────────────────────────────────────────────────────
    ("2026-03-21", "🎓 Inicio Turno Flotante 1°C (sábados)"),
    ("2026-06-13", "🎓 Fin Turno Flotante 1°C (sábados)"),

    ("2026-06-22", "🎓 Inicio Turno Jul-Ago · 1° llamado"),
    ("2026-07-04", "🎓 Fin Turno Jul-Ago · 1° llamado"),

    ("2026-07-20", "🎓 Inicio Turno Jul-Ago · 2° llamado"),
    ("2026-08-01", "🎓 Fin Turno Jul-Ago · 2° llamado"),

    ("2026-08-22", "🎓 Inicio Turno Flotante 2°C (sábados)"),
    ("2026-11-07", "🎓 Fin Turno Flotante 2°C (sábados)"),

    ("2026-11-23", "🎓 Inicio Turno Nov-Dic · 1° llamado"),
    ("2026-12-05", "🎓 Fin Turno Nov-Dic · 1° llamado"),

    ("2026-12-07", "🎓 Inicio Turno Nov-Dic · 2° llamado"),
    ("2026-12-21", "🎓 Fin Turno Nov-Dic · 2° llamado"),

    ("2027-02-01", "🎓 Inicio Turno Feb-Mar · 1° llamado"),
    ("2027-02-16", "🎓 Fin Turno Feb-Mar · 1° llamado"),

    ("2027-02-22", "🎓 Inicio Turno Feb-Mar · 2° llamado"),
    ("2027-03-06", "🎓 Fin Turno Feb-Mar · 2° llamado"),

    # ── OTRAS FECHAS CLAVE ──────────────────────────────────────────────────────
    ("2026-03-14", "🏛️ 1° Reunión Claustro Docente"),
    ("2026-08-08", "🏛️ 2° Reunión Claustro Docente"),
    ("2026-11-27", "🏛️ 3° Reunión Claustro Docente"),
    ("2026-08-31", "🎓 Última fecha presentación de títulos"),
    ("2026-11-07", "🎓 Actos de Graduación 2025-2026"),

    # ── EFEMÉRIDES UCEL ─────────────────────────────────────────────────────────
    ("2026-09-21", "📅 Día del Estudiante / Fiesta Universitaria (UCEL)"),
]


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    insertados = 0
    omitidos = 0

    for fecha, texto in EVENTOS:
        existe = conn.execute(
            "SELECT id FROM recordatorios WHERE fecha = ? AND texto = ?",
            (fecha, texto)
        ).fetchone()
        if existe:
            omitidos += 1
            continue
        conn.execute(
            "INSERT INTO recordatorios (fecha, texto) VALUES (?, ?)",
            (fecha, texto)
        )
        insertados += 1

    conn.commit()
    conn.close()
    print(f"OK: {insertados} recordatorios insertados, {omitidos} ya existian.")


if __name__ == "__main__":
    main()
