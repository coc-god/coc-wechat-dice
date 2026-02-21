"""CoC 7.0 opposed roll logic."""

from dice.roller import roll_d100
from dice.skill_check import SuccessLevel, determine_success


def opposed_roll(name1: str, skill1: int, name2: str, skill2: int) -> dict:
    """Perform an opposed roll between two parties.

    Higher success level wins. On tie, higher skill value wins.
    """
    r1 = roll_d100()
    r2 = roll_d100()

    level1 = determine_success(r1.total, skill1)
    level2 = determine_success(r2.total, skill2)

    rank1 = SuccessLevel.rank(level1)
    rank2 = SuccessLevel.rank(level2)

    if rank1 > rank2:
        winner = name1
    elif rank2 > rank1:
        winner = name2
    elif skill1 >= skill2:
        winner = name1
    else:
        winner = name2

    # Both fumble = nobody wins
    if level1 == SuccessLevel.FUMBLE and level2 == SuccessLevel.FUMBLE:
        winner = "双方"
        outcome = "双方大失败，均未成功！"
    # Both fail
    elif rank1 <= 1 and rank2 <= 1:
        winner = "无"
        outcome = "双方均未成功"
    else:
        outcome = f"🏆 {winner} 胜出！"

    details = (
        f"⚔️ 对抗检定\n"
        f"{name1} ({skill1}): d100 = {r1.total} 【{level1}】\n"
        f"{name2} ({skill2}): d100 = {r2.total} 【{level2}】\n"
        f"{outcome}"
    )

    return {
        "roll1": r1.total,
        "roll2": r2.total,
        "level1": level1,
        "level2": level2,
        "winner": winner,
        "details": details,
    }
