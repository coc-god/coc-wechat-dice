"""CoC 7.0 combat roll helpers."""

from dice.skill_check import skill_check
from dice.roller import roll_dice


def fighting_check(skill_value: int, bonus: int = 0, penalty: int = 0) -> dict:
    """Perform a Fighting (Brawl) check."""
    return skill_check("格斗", skill_value, bonus=bonus, penalty=penalty)


def firearms_check(skill_value: int, bonus: int = 0, penalty: int = 0) -> dict:
    """Perform a Firearms check."""
    return skill_check("射击", skill_value, bonus=bonus, penalty=penalty)


def dodge_check(skill_value: int, bonus: int = 0, penalty: int = 0) -> dict:
    """Perform a Dodge check."""
    return skill_check("闪避", skill_value, bonus=bonus, penalty=penalty)


def damage_roll(expression: str) -> dict:
    """Roll damage dice (e.g. '1d3+1d4', '2d6+2')."""
    result = roll_dice(expression)
    details = f"💥 伤害骰: {result.details}"
    return {
        "damage": result.total,
        "details": details,
    }
