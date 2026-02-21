"""CoC 7.0 skill check logic."""

from dice.roller import roll_d100


class SuccessLevel:
    FUMBLE = "大失败"
    FAILURE = "失败"
    REGULAR = "成功"
    HARD = "困难成功"
    EXTREME = "极难成功"
    CRITICAL = "大成功"

    # Numeric ordering for comparisons (opposed rolls)
    ORDER = {
        "大失败": 0,
        "失败": 1,
        "成功": 2,
        "困难成功": 3,
        "极难成功": 4,
        "大成功": 5,
    }

    @staticmethod
    def rank(level: str) -> int:
        return SuccessLevel.ORDER.get(level, -1)


def determine_success(roll_value: int, skill_value: int) -> str:
    """Determine success level for a CoC 7.0 skill check."""
    if roll_value == 1:
        return SuccessLevel.CRITICAL

    # Fumble: 96-100 if skill < 50, 100 if skill >= 50
    if skill_value < 50 and roll_value >= 96:
        return SuccessLevel.FUMBLE
    if roll_value == 100:
        return SuccessLevel.FUMBLE

    extreme = skill_value // 5
    hard = skill_value // 2

    if roll_value <= extreme:
        return SuccessLevel.EXTREME
    if roll_value <= hard:
        return SuccessLevel.HARD
    if roll_value <= skill_value:
        return SuccessLevel.REGULAR

    return SuccessLevel.FAILURE


def skill_check(skill_name: str, skill_value: int,
                bonus: int = 0, penalty: int = 0) -> dict:
    """Perform a skill check.

    Returns dict with: roll, skill_name, skill_value, success_level, details
    """
    result = roll_d100(bonus=bonus, penalty=penalty)
    success = determine_success(result.total, skill_value)

    hard = skill_value // 2
    extreme = skill_value // 5

    details = (
        f"🎲 {skill_name} 检定 (目标值: {skill_value})\n"
        f"d100 = {result.total}"
    )
    if bonus > 0 or penalty > 0:
        details += f"\n{result.details}"
    details += (
        f"\n困难: {hard} / 极难: {extreme}"
        f"\n结果: 【{success}】"
    )

    return {
        "roll": result.total,
        "skill_name": skill_name,
        "skill_value": skill_value,
        "success_level": success,
        "details": details,
    }
