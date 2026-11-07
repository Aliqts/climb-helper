/* ALL interface text lives here — edit freely.
 * {name} placeholders are filled in by the program; keep them where you want the value.
 * "\n" makes a new line. */
window.TEXTS = {
  pageTitle: "Минное поле",

  // ---------------------------------------------------------- part 1: character
  characterTitle: "Мой кот",
  ageLabel: "Луны:",
  agePlaceholder: "53.7",
  ageNoteEmpty: "Возраст сохраняется и повышается автоматически",
  ageNoteAuto: "Авто-повышение на +0.1 в {time} (твое локальное время). Если вам меньше 6 лун, корректируйте его если съезжает",
  levelLabel: "Лазательные умения:",
  levelHint: "Выбирайте 9+ если у вас 9 (100/∞)",
  buffLabel: "Бафф уменьшения урона (%):",
  hpLabel: "Текущее здоровье (из {max}):",

  errorAge: "Введите луны (например 53.7).",
  errorLevel: "Укажите свой ЛУ.",
  errorBuff: "Бафф должен быть % между 0 и 100.",
  errorHp: "Здоровье должно быть между 0 и {max}.",

  resultDamage: "Падение с {height} высоты снимет {damage} здоровья.",
  resultHpLeft: "У вас останется {left} / {max} здоровья.",
  resultExceeds: "Падение превышает ваше здоровье на {over}.",
  warnFatal: "☠  ВНИМАНИЕ: ВЫ УМРЕТЕ ЕСЛИ УПАДЕТЕ ОТСЮДА  ☠",
  warnDanger: "⚠  Опасно! Падение оставит вас только с {left}% здоровья.",
  warnOk: "✔  Падение отсюда не опасно для жизни.",

  allHeightsTitle: "Все высоты",
  colHeight: "Высота",
  colDamage: "Урон от падения",
  colHpLeft: "Оставшееся здоровье",
  deadMark: "☠",
  madeBy: " ",

  // ---------------------------------------------------------- part 2: tabs
  fieldTitle: "Минное поле",
  newLocationName: "Локация {n}",
  newHeightName: "Высота {n}",
  addLocation: "+ Локация",
  addHeight: "+ Высота",
  addHeightMax: "Максимум {max} высот",
  renameTooltip: "Двойной клик чтобы переименовать",
  renameLocationPrompt: "Новое название локации:",
  renameHeightPrompt: "Новое название высоты:",
  renameButton: "Переименовать",
  deleteLocation: "Удалить локацию",
  deleteHeight: "Удалить высоту",
  deleteLocationConfirm: "Удалить локацию \"{name}\" со всеми ее высотами? Это действие нельзя отменить.",
  deleteHeightConfirm: "Удалить \"{name}\" и все отметки на поле? Это действие нельзя отменить.",
  deleteHeightOnlyLast: "Только последнюю высоту можно удалить (высота N должна оставаться высотой N).",
  heightTag: "высота {n}",

  // ---------------------------------------------------------- part 2: tools
  modesTitle: "Режим мыши:",
  modeSelect: "Выбрать",
  modeDanger: "Мина (-)",
  modeLocational: "Переход (=)",
  modeErase: "Стереть",
  keyboardHint: "Клавиатура: выбери клетку, и нажми 0-7, - (мина), = (переход), Стереть (очистить) или стрелочки (передвижение). Ctrl+Z чтобы отменить.",
  undo: "Отменить",
  resetField: "Очистить поле",
  resetFieldConfirm: "Очистить все поле \"{name}\"? (Это можно отменить.)",
  doneLocational: "Переходы помечены",
  backToLocational: "Изменить переходы",
  exportButton: "Экспорт сохранения",
  importButton: "Импорт сохранения",
  importConfirm: "Заменить ВСЕ ваши данные на импортированные?",
  importError: "Это не рабочий файл сохранения.",

  // ---------------------------------------------------------- part 2: guidance
  stepLocational: "Шаг 1: отметь все переходы на \"=\" и нажми \"{button}\".",
  stepFill: "Встань на ЖЕЛТЫЕ клетки (они безопасны) и введи на них громкость из чата (Осталось {count}).",
  stepJump: "Не осталось безопасных клеток. Прыгай между двумя ГОЛУБЫМИ клетками ({a} ↔ {b}) пока не получишь подсказку (Выглядит как !!!) и пометь ее как опасную на \"-\".",
  stepStuck: "Нельзя безопасно получить больше информации. {count} клеток неизвестны.",
  stepDone: "Карта готова! Все клетки помечены.",
  stepConflict: "Что-то не стыкуется вокруг {cells}. Перепроверь пометки там (клетки с красной обводкой).",
  stepTooComplex: "Поле слишком сложное чтобы решить полностью, результаты могут быть неполными.",

  lockTitle: "Падение отсюда {status}!",
  lockStatusDanger: "ОПАСНО",
  lockStatusFatal: "СМЕРТЕЛЬНО",
  lockBody: "Падение оставит только {left}% здоровья. Полечись или используй баффы если можешь.",
  lockConfirm: "Я понимаю риск — пусти меня к полю",

  legendTitle: "Справка:",
  legendAsk: "безопасная — укажи громкость",
  legendDanger: "опасная",
  legendUnreachable: "недоступная",
  legendJump: "прыгай тут за подсказкой",
  legendLocational: "переход",
  legendUnknown: "неизвестно",
  legendDerived: "автоматически расчитанная громкость",
  legendRisk: "% в углу - шанс клетки быть миной (выше = хуже)",

  cellLocational: "⇆",   // symbol shown in locational cells
  cellDanger: "✖",       // symbol shown in dangerous cells
  cellUnreachable: "✖",  // symbol shown in unreachable cells
  unreachableTooltip: "{cell}: недоступна — до нее не добраться, не наступив на мину",
  probTooltip: "{cell}: {percent}% шанс наличия мины ({safe}% шанс безопасности)",
  derivedTooltip: "{cell}: безопасна, ее громкость точно {number} (расчитано). Введи номер чтобы изменить.",
  conflictTooltip: "что-то не так — проверь клетку",
  cellTooltip: "{cell}",

  storageWarning: "Твой браузер блокирует сохранение — данные будут потеряны при закрытии страницы. Используй экспорт чтобы их сохранить.",
};
