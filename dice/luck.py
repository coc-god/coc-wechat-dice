"""CoC 7.0 luck spending mechanic."""


def spend_luck(current_luck: int, spend_amount: int,
               skill_name: str, original_roll: int,
               skill_value: int) -> dict:
    """Spend luck points to improve a skill check result.

    The player can spend luck to reduce their roll value, potentially
    achieving a better success level.

    Returns dict with: new_roll, new_luck, details
    """
    if spend_amount <= 0:
        return {
            "success": False,
            "details": "❌ 花费幸运值必须大于0",
        }

    if spend_amount > current_luck:
        return {
            "success": False,
            "details": f"❌ 幸运值不足！当前幸运: {current_luck}，需要: {spend_amount}",
        }

    new_roll = original_roll - spend_amount
    new_luck = current_luck - spend_amount

    if new_roll < 1:
        new_roll = 1

    from dice.skill_check import determine_success
    new_level = determine_success(new_roll, skill_value)

    details = (
        f"🍀 幸运消耗\n"
        f"{skill_name} 检定\n"
        f"原始骰值: {original_roll} → 新骰值: {new_roll}\n"
        f"消耗幸运: {spend_amount}\n"
        f"剩余幸运: {new_luck}\n"
        f"新结果: 【{new_level}】"
    )

    return {
        "success": True,
        "new_roll": new_roll,
        "new_luck": new_luck,
        "new_level": new_level,
        "details": details,
    }
