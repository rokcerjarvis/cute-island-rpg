# Milestone 8 Battle Balance Report

Final: floor((Attack × 0.7 + SkillPower × 0.25 + Level × 0.3) × attribute × U[0.9,1.1)); damaging skills minimum 1, zero-power skills remain 0.

120 cases × 1,000 seeded trials = 120,000 isolated attacker-to-KO trials. KO turns include accuracy misses; defender does not retaliate in this table. Damage averages count successful hits before HP clamp. Two-shot means exactly two attempted attacks. No IV/EV/hidden variance. Skills 001/007/008 represent Stable/Heavy/Quick; simulations deliberately evaluate the category even if the level has not learned it yet. Boss simulations use the real turn engine and learned skills.

Level coefficient reduced from proposed 0.5 to 0.3 to prevent late-level KO lengths steadily shrinking. Advantage 1.5, disadvantage 0.75, PURE_CUTE neutral are unchanged. Heal/Defend/debuff/passive mechanics unchanged.

|Case|Lv|Skill|Mean KO|Median|Min|Max|1-shot %|2-shot %|Mean hit|HP %|Multiplier|Actual / neutral|
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
|neutral|5|SKILL_001|4.37|4|4|5|0.0|0.0|13.00|25.0|1|1.000|
|neutral|5|SKILL_007|4.35|4|3|11|0.0|0.0|21.75|41.8|1|1.000|
|neutral|5|SKILL_008|5.00|5|5|5|0.0|0.0|11.50|22.1|1|1.000|
|advantage|5|SKILL_001|3.00|3|2|3|0.0|0.5|19.74|44.9|1.5|1.520|
|advantage|5|SKILL_007|2.84|3|2|10|0.0|48.6|32.87|74.7|1.5|1.510|
|advantage|5|SKILL_008|3.00|3|3|3|0.0|0.0|17.50|39.8|1.5|1.521|
|disadvantage|5|SKILL_001|7.01|7|7|8|0.0|0.0|9.63|15.0|0.75|0.741|
|disadvantage|5|SKILL_007|6.24|6|4|17|0.0|0.0|16.23|25.4|0.75|0.745|
|disadvantage|5|SKILL_008|8.00|8|8|8|0.0|0.0|8.50|13.3|0.75|0.739|
|PURE_CUTE|5|SKILL_001|5.03|5|5|6|0.0|0.0|10.92|21.0|1|1.000|
|PURE_CUTE|5|SKILL_007|4.30|4|3|10|0.0|0.0|19.67|37.8|1|1.000|
|PURE_CUTE|5|SKILL_008|6.00|6|6|6|0.0|0.0|9.40|18.1|1|1.000|
|high Attack neutral|5|SKILL_001|3.00|3|3|3|0.0|0.0|17.23|39.2|1|1.000|
|high Attack neutral|5|SKILL_007|2.92|3|2|8|0.0|46.9|25.92|58.9|1|1.000|
|high Attack neutral|5|SKILL_008|3.02|3|3|4|0.0|0.0|15.74|35.8|1|1.000|
|high Attack advantage|5|SKILL_001|2.00|2|2|2|0.0|100.0|26.07|56.7|1.5|1.512|
|high Attack advantage|5|SKILL_007|2.88|3|2|9|0.0|48.0|39.13|85.1|1.5|1.510|
|high Attack advantage|5|SKILL_008|2.16|2|2|3|0.0|84.4|23.83|51.8|1.5|1.518|
|high HP neutral|5|SKILL_001|4.00|4|4|5|0.0|0.0|17.23|26.9|1|1.000|
|high HP neutral|5|SKILL_007|4.35|4|3|11|0.0|0.0|25.94|40.5|1|1.000|
|high HP neutral|5|SKILL_008|4.67|5|4|5|0.0|0.0|15.67|24.5|1|1.000|
|starter wind/water|5|SKILL_001|4.37|4|4|5|0.0|0.0|13.00|25.0|1|1.000|
|starter wind/water|5|SKILL_007|4.32|4|3|14|0.0|0.0|21.81|41.9|1|1.000|
|starter wind/water|5|SKILL_008|5.00|5|5|5|0.0|0.0|11.50|22.1|1|1.000|
|starter earth/wind|5|SKILL_001|5.00|5|5|5|0.0|0.0|10.16|22.1|0.75|0.740|
|starter earth/wind|5|SKILL_007|4.36|4|3|15|0.0|0.0|16.70|36.3|0.75|0.743|
|starter earth/wind|5|SKILL_008|5.56|6|5|6|0.0|0.0|9.04|19.7|0.75|0.742|
|starter earth/water|5|SKILL_001|3.00|3|3|3|0.0|0.0|20.77|39.9|1.5|1.518|
|starter earth/water|5|SKILL_007|2.82|3|2|10|0.0|49.5|33.92|65.2|1.5|1.512|
|starter earth/water|5|SKILL_008|3.01|3|3|4|0.0|0.0|18.51|35.6|1.5|1.524|
|neutral|10|SKILL_001|4.31|4|4|5|0.0|0.0|16.63|25.2|1|1.000|
|neutral|10|SKILL_007|4.35|4|3|14|0.0|0.0|25.40|38.5|1|1.000|
|neutral|10|SKILL_008|5.00|5|4|5|0.0|0.0|15.12|22.9|1|1.000|
|advantage|10|SKILL_001|3.00|3|2|3|0.0|0.1|25.15|44.9|1.5|1.517|
|advantage|10|SKILL_007|2.86|2|2|10|0.0|50.7|38.28|68.3|1.5|1.510|
|advantage|10|SKILL_008|3.00|3|3|3|0.0|0.0|23.00|41.1|1.5|1.517|
|disadvantage|10|SKILL_001|7.00|7|6|8|0.0|0.0|12.28|15.3|0.75|0.741|
|disadvantage|10|SKILL_007|7.14|7|4|17|0.0|0.0|18.88|23.6|0.75|0.745|
|disadvantage|10|SKILL_008|7.75|8|7|8|0.0|0.0|11.18|14.0|0.75|0.739|
|PURE_CUTE|10|SKILL_001|5.03|5|5|6|0.0|0.0|13.80|20.9|1|1.000|
|PURE_CUTE|10|SKILL_007|4.54|4|3|12|0.0|0.0|22.55|34.2|1|1.000|
|PURE_CUTE|10|SKILL_008|5.99|6|5|6|0.0|0.0|12.28|18.6|1|1.000|
|high Attack neutral|10|SKILL_001|3.00|3|3|3|0.0|0.0|21.51|38.4|1|1.000|
|high Attack neutral|10|SKILL_007|2.85|3|2|10|0.0|49.4|30.24|54.0|1|1.000|
|high Attack neutral|10|SKILL_008|3.02|3|3|4|0.0|0.0|19.99|35.7|1|1.000|
|high Attack advantage|10|SKILL_001|2.00|2|2|2|0.0|100.0|32.45|56.0|1.5|1.512|
|high Attack advantage|10|SKILL_007|2.88|3|2|9|0.0|48.2|45.58|78.6|1.5|1.508|
|high Attack advantage|10|SKILL_008|2.15|2|2|3|0.0|84.9|30.20|52.1|1.5|1.512|
|high HP neutral|10|SKILL_001|4.01|4|4|5|0.0|0.0|21.46|26.8|1|1.000|
|high HP neutral|10|SKILL_007|4.28|4|3|12|0.0|0.0|30.28|37.9|1|1.000|
|high HP neutral|10|SKILL_008|4.41|4|4|5|0.0|0.0|20.02|25.0|1|1.000|
|starter wind/water|10|SKILL_001|4.36|4|4|5|0.0|0.0|16.59|25.1|1|1.000|
|starter wind/water|10|SKILL_007|4.26|4|3|11|0.0|0.0|25.35|38.4|1|1.000|
|starter wind/water|10|SKILL_008|5.00|5|5|5|0.0|0.0|15.11|22.9|1|1.000|
|starter earth/wind|10|SKILL_001|5.00|5|5|5|0.0|0.0|12.91|22.3|0.75|0.744|
|starter earth/wind|10|SKILL_007|4.88|5|3|14|0.0|0.0|19.43|33.5|0.75|0.746|
|starter earth/wind|10|SKILL_008|5.21|5|5|6|0.0|0.0|11.77|20.3|0.75|0.747|
|starter earth/water|10|SKILL_001|3.00|3|3|3|0.0|0.0|26.19|39.7|1.5|1.512|
|starter earth/water|10|SKILL_007|2.88|3|2|9|0.0|49.0|39.28|59.5|1.5|1.509|
|starter earth/water|10|SKILL_008|3.00|3|3|3|0.0|0.0|23.95|36.3|1.5|1.518|
|neutral|20|SKILL_001|4.28|4|4|5|0.0|0.0|23.80|25.3|1|1.000|
|neutral|20|SKILL_007|4.42|4|3|11|0.0|0.0|32.52|34.6|1|1.000|
|neutral|20|SKILL_008|4.95|5|4|5|0.0|0.0|22.31|23.7|1|1.000|
|advantage|20|SKILL_001|3.00|3|2|3|0.0|0.1|35.94|44.9|1.5|1.510|
|advantage|20|SKILL_007|2.91|3|2|11|0.0|46.1|49.10|61.4|1.5|1.507|
|advantage|20|SKILL_008|3.00|3|3|3|0.0|0.0|33.72|42.1|1.5|1.513|
|disadvantage|20|SKILL_001|6.99|7|6|7|0.0|0.0|17.70|15.7|0.75|0.743|
|disadvantage|20|SKILL_007|7.06|7|5|14|0.0|0.0|24.33|21.5|0.75|0.746|
|disadvantage|20|SKILL_008|7.09|7|7|8|0.0|0.0|16.59|14.7|0.75|0.744|
|PURE_CUTE|20|SKILL_001|5.03|5|5|6|0.0|0.0|19.61|20.9|1|1.000|
|PURE_CUTE|20|SKILL_007|5.70|5|4|14|0.0|0.0|28.35|30.2|1|1.000|
|PURE_CUTE|20|SKILL_008|5.88|6|5|6|0.0|0.0|18.09|19.2|1|1.000|
|high Attack neutral|20|SKILL_001|3.00|3|3|3|0.0|0.0|30.82|38.5|1|1.000|
|high Attack neutral|20|SKILL_007|3.61|3|2|10|0.0|22.6|39.54|49.4|1|1.000|
|high Attack neutral|20|SKILL_008|3.00|3|3|4|0.0|0.0|29.37|36.7|1|1.000|
|high Attack advantage|20|SKILL_001|2.00|2|2|2|0.0|100.0|46.45|56.0|1.5|1.507|
|high Attack advantage|20|SKILL_007|2.84|3|2|8|0.0|49.7|59.75|72.0|1.5|1.506|
|high Attack advantage|20|SKILL_008|2.08|2|2|3|0.0|92.2|44.14|53.2|1.5|1.508|
|high HP neutral|20|SKILL_001|4.00|4|4|4|0.0|0.0|30.78|27.2|1|1.000|
|high HP neutral|20|SKILL_007|4.43|4|3|10|0.0|0.0|39.61|35.1|1|1.000|
|high HP neutral|20|SKILL_008|4.11|4|4|5|0.0|0.0|29.29|25.9|1|1.000|
|starter wind/water|20|SKILL_001|4.28|4|4|5|0.0|0.0|23.82|25.3|1|1.000|
|starter wind/water|20|SKILL_007|4.41|4|3|13|0.0|0.0|32.54|34.6|1|1.000|
|starter wind/water|20|SKILL_008|4.95|5|4|5|0.0|0.0|22.30|23.7|1|1.000|
|starter earth/wind|20|SKILL_001|5.00|5|4|5|0.0|0.0|18.76|22.6|0.75|0.744|
|starter earth/wind|20|SKILL_007|5.65|5|4|12|0.0|0.0|25.40|30.6|0.75|0.746|
|starter earth/wind|20|SKILL_008|5.00|5|5|6|0.0|0.0|17.64|21.3|0.75|0.744|
|starter earth/water|20|SKILL_001|3.00|3|3|3|0.0|0.0|38.06|40.5|1.5|1.510|
|starter earth/water|20|SKILL_007|2.94|3|2|9|0.0|47.0|51.14|54.4|1.5|1.506|
|starter earth/water|20|SKILL_008|3.00|3|3|3|0.0|0.0|35.69|38.0|1.5|1.510|
|neutral|30|SKILL_001|4.08|4|4|5|0.0|0.0|31.66|26.0|1|1.000|
|neutral|30|SKILL_007|5.05|5|3|12|0.0|0.0|40.44|33.1|1|1.000|
|neutral|30|SKILL_008|4.57|5|4|5|0.0|0.0|30.19|24.7|1|1.000|
|advantage|30|SKILL_001|2.98|3|2|3|0.0|2.0|47.85|46.0|1.5|1.507|
|advantage|30|SKILL_007|2.86|3|2|11|0.0|47.1|60.99|58.6|1.5|1.507|
|advantage|30|SKILL_008|3.00|3|3|3|0.0|0.0|45.52|43.8|1.5|1.508|
|disadvantage|30|SKILL_001|6.84|7|6|7|0.0|0.0|23.65|16.2|0.75|0.746|
|disadvantage|30|SKILL_007|7.23|7|5|17|0.0|0.0|30.19|20.7|0.75|0.747|
|disadvantage|30|SKILL_008|7.00|7|7|8|0.0|0.0|22.51|15.4|0.75|0.746|
|PURE_CUTE|30|SKILL_001|5.00|5|5|6|0.0|0.0|26.13|21.4|1|1.000|
|PURE_CUTE|30|SKILL_007|5.71|5|4|12|0.0|0.0|34.87|28.6|1|1.000|
|PURE_CUTE|30|SKILL_008|5.33|5|5|6|0.0|0.0|24.58|20.1|1|1.000|
|high Attack neutral|30|SKILL_001|3.00|3|3|3|0.0|0.0|40.06|38.5|1|1.000|
|high Attack neutral|30|SKILL_007|4.24|4|2|12|0.0|4.4|49.01|47.1|1|1.000|
|high Attack neutral|30|SKILL_008|3.00|3|3|3|0.0|0.0|38.59|37.1|1|1.000|
|high Attack advantage|30|SKILL_001|2.00|2|2|2|0.0|100.0|60.44|56.0|1.5|1.506|
|high Attack advantage|30|SKILL_007|2.86|3|2|9|0.0|48.8|73.51|68.1|1.5|1.505|
|high Attack advantage|30|SKILL_008|2.04|2|2|3|0.0|96.4|58.23|53.9|1.5|1.507|
|high HP neutral|30|SKILL_001|4.00|4|4|4|0.0|0.0|40.08|27.5|1|1.000|
|high HP neutral|30|SKILL_007|4.86|5|3|12|0.0|0.0|48.86|33.5|1|1.000|
|high HP neutral|30|SKILL_008|4.02|4|4|5|0.0|0.0|38.61|26.4|1|1.000|
|starter wind/water|30|SKILL_001|4.06|4|4|5|0.0|0.0|31.77|26.0|1|1.000|
|starter wind/water|30|SKILL_007|5.05|5|3|13|0.0|0.0|40.48|33.2|1|1.000|
|starter wind/water|30|SKILL_008|4.57|5|4|5|0.0|0.0|30.21|24.8|1|1.000|
|starter earth/wind|30|SKILL_001|5.00|5|4|5|0.0|0.0|24.69|22.9|0.75|0.746|
|starter earth/wind|30|SKILL_007|5.74|5|4|14|0.0|0.0|31.23|28.9|0.75|0.746|
|starter earth/wind|30|SKILL_008|5.00|5|5|5|0.0|0.0|23.57|21.8|0.75|0.746|
|starter earth/water|30|SKILL_001|3.00|3|3|3|0.0|0.0|49.93|40.9|1.5|1.508|
|starter earth/water|30|SKILL_007|3.18|3|2|10|0.0|38.8|63.10|51.7|1.5|1.506|
|starter earth/water|30|SKILL_008|3.00|3|3|3|0.0|0.0|47.53|39.0|1.5|1.507|

## Boss engine simulation

Boss Lv11: HP128 / Attack14 / Speed11; stable 40%, headbutt30%, heavy20%, brace10%; below35% HP headbutt40%, heavy30%, stable20%, brace10%. Previous HP80/Attack15/Speed13, heavy-only. Each Lv12 representative can use up to two same-species reserves; at most two heals below45% when learned. This is a declared strategy, not a universal win guarantee. Commands count player selections, effective actions count successful player ACTION events; opponent actions are excluded.

|Species|Win %|Player commands|Effective player actions|Heals|Forced switches|
|---|---:|---:|---:|---:|---:|
|CUTE_001|100.0|9.34|8.98|1.99|0.97|
|CUTE_002|100.0|7.08|7.08|0.00|0.99|
|CUTE_003|100.0|4.32|3.00|0.00|0.15|
|CUTE_004|43.3|10.85|7.48|0.00|1.91|
|CUTE_005|100.0|10.72|9.92|1.99|1.29|

## 結果摘要與解讀

- 120,000 同級攻擊試驗：所有案例 one-shot rate = 0%。這不是所有等級差、技能組合或未來生物的保證。
- 吉伊卡哇 Neutral Stable：Lv5 4.371、Lv10 4.312、Lv20 4.276、Lv30 4.085 次；Lv5→30 約下降6.5%，沒有明顯持續縮短至一兩回合。
- Water→Fire Advantage Stable 約2.98～3.00次，Advantage Heavy 約2.84～2.91次（含30% miss），Heavy exactly-two-shot rate 約46.1%～50.7%。
- PURE_CUTE Stable 約5.00～5.03次；Quick 約5.33～6.00次，仍可輸出且保留priority／30%被動。
- Heavy 的單次命中傷害高於 Stable；平均KO時間可能因70%命中率較長。不是每個 matchup 都保證Heavy更快。
- 高HP且有屬性劣勢的對手可超過5回合，這是換人與屬性選擇的價值。屬性實際影響略偏離1.5／0.75是floor誤差。
- Boss通常以中性同伴＋補血／換人達6～10次有效玩家行動：Water12平均8.985，Wind12平均7.077，PURE12平均9.918。Fire12 Heavy＋advantage仍可約3次成功攻擊擊倒；Earth12同種三人策略勝率43.3%。不將這些反例隱藏為全部對戰6～10。混合隊伍的自然RNG QA使用Water攻擊／Heal／Defend，再換Rabbit Heavy，另記錄實際指令數。
- 普通表格只量測單方連續攻擊，不模擬反擊、學招可用性或Heal循環；Boss表才使用真正AI、命中、被動與換人。

## Lv5 baseline與成長

|Species|HP before→after|Attack|Speed|HP growth before→after|Attack growth before→after|
|---|---|---:|---:|---|---|
|吉伊卡哇|35→52|10|10|2→2.8|0.8→0.65|
|小八|30→46|10|15|1.8→2.5|0.8→0.65|
|兔兔|28→44|16|12|1.7→2.4|1.3→0.9|
|栗子饅頭|44→64|11|6|2.5→3.3|0.9→0.7|
|飛鼠|34→50|7|11|2→2.7|0.6→0.45|

HP growth增加、Attack growth下降，Speed growth未變；14個技能power與accuracy不變。EVO_001 HP66／growth3.4／ATK growth0.8，EVO_002 HP62／growth3.3／ATK growth0.55；MON_001 HP44／growth2.5，MON_002 HP62／growth3.2／ATK growth0.9。

Rerun with `npm run simulate:balance`. Full raw evidence: artifacts/milestone-8-balance.json. Manual unforced Boss QA is recorded separately in MILESTONE_8_REPORT.md.
