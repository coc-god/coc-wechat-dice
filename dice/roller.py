"""Core dice rolling engine for CoC 7.0."""

from __future__ import annotations

import random
import re
from typing import List, NamedTuple


class DiceResult(NamedTuple):
    total: int
    details: str  # e.g. "3d6: [2, 5, 1] = 8"


class D100Result(NamedTuple):
    total: int
    tens_options: List[int]  # all tens dice rolled (for bonus/penalty)
    units: int
    details: str


def roll(sides: int) -> int:
    return random.randint(1, sides)


def roll_dice(notation: str) -> DiceResult:
    """Parse and roll dice notation like '3d6+2', '1d100', '2d6+6', '1d8-1'.

    Supports: NdX, NdX+M, NdX-M, plain number, multiple terms like 1d3+1d4+2.
    """
    notation = notation.strip().lower()
    if not notation:
        return DiceResult(0, "无效的骰子表达式")

    # Match terms: optional sign, then either NdX or plain number
    term_pattern = re.compile(r'([+-]?)\s*(?:(\d*)d(\d+)|(\d+))')
    terms = term_pattern.findall(notation)

    if not terms:
        return DiceResult(0, f"无法解析: {notation}")

    total = 0
    parts = []

    for sign_str, count_str, sides_str, plain_num in terms:
        sign = -1 if sign_str == '-' else 1

        if sides_str:  # NdX term
            count = int(count_str) if count_str else 1
            sides = int(sides_str)
            if count > 100 or sides > 10000:
                return DiceResult(0, "骰子数量或面数过大")
            rolls = [roll(sides) for _ in range(count)]
            subtotal = sum(rolls) * sign
            total += subtotal
            roll_str = f"{count}d{sides}: {rolls}"
            if sign == -1:
                roll_str = f"-{roll_str}"
            parts.append(roll_str)
        else:  # plain number
            num = int(plain_num) * sign
            total += num
            parts.append(str(num))

    details = " + ".join(parts) + f" = {total}"
    return DiceResult(total, details)


def roll_d100(bonus: int = 0, penalty: int = 0) -> D100Result:
    """Roll d100 with optional bonus/penalty dice.

    bonus: number of bonus dice (extra tens dice, pick lowest)
    penalty: number of penalty dice (extra tens dice, pick highest)

    Bonus and penalty cancel each other out first.
    """
    # Cancel out bonus and penalty
    net = bonus - penalty
    extra_tens = abs(net)
    is_bonus = net > 0

    units = roll(10) - 1  # 0-9
    tens_rolls = [roll(10) - 1 for _ in range(1 + extra_tens)]  # 0-9 each

    if is_bonus:
        chosen_tens = min(tens_rolls)
    else:
        chosen_tens = max(tens_rolls)

    # Handle 00+0 = 100
    result = chosen_tens * 10 + units
    if result == 0:
        result = 100

    tens_display = [t * 10 for t in tens_rolls]
    detail_parts = [f"十位: {tens_display}"]
    if extra_tens > 0:
        kind = "奖励骰" if is_bonus else "惩罚骰"
        detail_parts.append(f"({kind}x{extra_tens})")
    detail_parts.append(f"选择: {chosen_tens * 10}")
    detail_parts.append(f"个位: {units}")
    detail_parts.append(f"= {result}")

    details = " ".join(detail_parts)
    return D100Result(result, tens_rolls, units, details)


def roll_expression(expr: str) -> DiceResult:
    """Roll a dice expression, defaulting to 1d100 if empty."""
    expr = expr.strip()
    if not expr:
        result = roll_d100()
        return DiceResult(result.total, f"1d100 = {result.total}")
    return roll_dice(expr)
