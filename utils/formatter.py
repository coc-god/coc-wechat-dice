"""Format dice results for WeChat display."""


def format_reply(player_name: str, content: str) -> str:
    """Wrap a result with player name header."""
    return f"@{player_name}\n{content}"


def help_text(topic: str = "") -> str:
    """Return help text for commands."""
    topic = topic.strip().lower()

    if topic == "r":
        return (
            "🎲 掷骰指令 .r\n"
            ".r 1d100 — 掷1个100面骰\n"
            ".r 3d6 — 掷3个6面骰\n"
            ".r 1d8+2 — 掷1d8并加2\n"
            ".r / .rd — 快速掷1d100"
        )

    if topic == "rc":
        return (
            "🎲 技能检定 .rc\n"
            ".rc 技能名 目标值 — 进行技能检定\n"
            ".rc 侦查 60 — 以60为目标值检定侦查\n"
            ".rc 侦查 60 b — 1个奖励骰\n"
            ".rc 侦查 60 b2 — 2个奖励骰\n"
            ".rc 侦查 60 p — 1个惩罚骰\n"
            ".rc 侦查 60 p2 — 2个惩罚骰\n"
            "\n成功等级:\n"
            "  大成功: 01\n"
            "  极难成功: ≤技能值/5\n"
            "  困难成功: ≤技能值/2\n"
            "  成功: ≤技能值\n"
            "  失败: >技能值\n"
            "  大失败: 技能<50时96-100，否则100"
        )

    if topic == "san":
        return (
            "🧠 理智检定 .san\n"
            ".san 当前SAN 成功损失/失败损失\n"
            ".san 55 1d3/1d10 — SAN55检定，成功失1d3，失败失1d10"
        )

    if topic == "rop":
        return (
            "⚔️ 对抗检定 .rop\n"
            ".rop 技能1 值1 vs 技能2 值2\n"
            ".rop 力量 60 vs 力量 45"
        )

    if topic == "coc":
        return (
            "📋 生成角色 .coc\n"
            ".coc — 生成1组调查员属性\n"
            ".coc 5 — 生成5组供选择"
        )

    if topic == "luck":
        return (
            "🍀 幸运消耗 .luck\n"
            ".luck set 值 — 设置当前幸运值\n"
            ".luck spend 数量 技能名 技能值 — 花费幸运改善上次检定"
        )

    # Default: full help
    return (
        "🎲 CoC 7.0 骰娘 指令列表\n"
        "━━━━━━━━━━━━━━━━\n"
        ".r [表达式] — 掷骰 (如 1d100, 3d6+2)\n"
        ".rd — 快速d100\n"
        ".rc 技能 目标值 [b/p] — 技能检定\n"
        ".san SAN值 成功/失败 — 理智检定\n"
        ".rop 名1 值1 vs 名2 值2 — 对抗检定\n"
        ".fight 值 — 格斗检定\n"
        ".fire 值 — 射击检定\n"
        ".dodge 值 — 闪避检定\n"
        ".dmg 表达式 — 伤害骰\n"
        ".coc [数量] — 生成调查员属性\n"
        ".luck set/spend — 幸运管理\n"
        ".help [指令] — 查看帮助\n"
        "━━━━━━━━━━━━━━━━\n"
        "使用 .help 指令名 查看详细说明"
    )
