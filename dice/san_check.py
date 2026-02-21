"""CoC 7.0 Sanity (SAN) check logic."""

from dice.roller import roll_d100, roll_dice


def san_check(san_value: int, success_loss: str, fail_loss: str) -> dict:
    """Perform a SAN check.

    Args:
        san_value: Current SAN value
        success_loss: Dice expression for SAN loss on success (e.g. "1d3")
        fail_loss: Dice expression for SAN loss on failure (e.g. "1d10")

    Returns dict with: roll, passed, san_loss, new_san, details
    """
    result = roll_d100()
    passed = result.total <= san_value

    if passed:
        loss_result = roll_dice(success_loss)
        loss_expr = success_loss
    else:
        loss_result = roll_dice(fail_loss)
        loss_expr = fail_loss

    san_loss = max(0, loss_result.total)
    new_san = max(0, san_value - san_loss)

    check_result = "成功" if passed else "失败"

    details = (
        f"🧠 SAN 检定 (当前SAN: {san_value})\n"
        f"d100 = {result.total} / 目标值: {san_value}\n"
        f"结果: 【{check_result}】\n"
        f"理智损失: {loss_expr} = {san_loss}\n"
        f"剩余SAN: {new_san}"
    )

    # Check for indefinite insanity (5+ loss in one check)
    warnings = []
    if san_loss >= 5:
        warnings.append("⚠️ 单次理智损失≥5点，可能陷入临时性疯狂！")
    if new_san == 0:
        warnings.append("☠️ 理智值降至0，调查员永久疯狂！")

    if warnings:
        details += "\n" + "\n".join(warnings)

    return {
        "roll": result.total,
        "passed": passed,
        "san_loss": san_loss,
        "new_san": new_san,
        "details": details,
    }
