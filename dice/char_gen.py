"""CoC 7.0 character stat generation."""

from __future__ import annotations

from typing import Optional

from dice.roller import roll_dice


# CoC 7.0 characteristic generation rules:
# STR, CON, DEX, APP, POW: 3d6 * 5
# SIZ, INT, EDU: (2d6+6) * 5
# Luck: 3d6 * 5

STATS_3D6 = ["STR", "CON", "DEX", "APP", "POW"]
STATS_2D6_PLUS_6 = ["SIZ", "INT", "EDU"]
STAT_NAMES = {
    "STR": "力量", "CON": "体质", "SIZ": "体型",
    "DEX": "敏捷", "APP": "外貌", "INT": "智力",
    "POW": "意志", "EDU": "教育", "LUCK": "幸运",
}
STAT_ORDER = ["STR", "CON", "SIZ", "DEX", "APP", "INT", "POW", "EDU", "LUCK"]


def generate_one() -> dict:
    """Generate one set of CoC 7.0 characteristics."""
    stats = {}

    for stat in STATS_3D6:
        r = roll_dice("3d6")
        stats[stat] = r.total * 5

    for stat in STATS_2D6_PLUS_6:
        r = roll_dice("2d6+6")
        stats[stat] = r.total * 5

    # Luck
    r = roll_dice("3d6")
    stats["LUCK"] = r.total * 5

    return stats


def format_stats(stats: dict, index: Optional[int] = None) -> str:
    """Format a stat block for display."""
    header = "📋 调查员属性" if index is None else f"📋 第{index}组属性"
    lines = [header]
    for key in STAT_ORDER:
        name = STAT_NAMES[key]
        lines.append(f"  {name}({key}): {stats[key]}")

    total = sum(stats[v] for v in STAT_ORDER if v != "LUCK")
    lines.append(f"  总计(不含幸运): {total}")
    return "\n".join(lines)


def generate_characters(count: int = 1) -> str:
    """Generate one or more character stat sets."""
    count = max(1, min(count, 10))  # cap at 10
    results = []
    for i in range(count):
        stats = generate_one()
        idx = (i + 1) if count > 1 else None
        results.append(format_stats(stats, idx))

    return "\n\n".join(results)
