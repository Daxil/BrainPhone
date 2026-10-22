/**
 * Схема разметки датасета — повторяет лист «Субъекты Р и С - НОВЫЕ» из
 * BRAINPHONE_датасет_расшифровка (колонки A…BW + блок «АУДИОЗАПИСИ» BZ…CF).
 *
 * Единый источник правды: по ней клиент строит форму, сервер валидирует
 * сохраняемые значения и собирает XLSX-выгрузку. Ключ поля = буква колонки,
 * чтобы выгрузка один-в-один ложилась на шаблон.
 *
 * Списки значений скопированы из data validation шаблона дословно (включая
 * хвостовые пробелы вида «1 - ВЫКЛ »): существующий датасет хранит именно их.
 */

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect';

export interface DatasetField {
  key: string;          // буква колонки в шаблоне
  header: string;       // заголовок колонки (как в шаблоне)
  label: string;        // короткая подпись для формы
  group: string;
  type: FieldType;
  options?: string[];
  /** number: кроме чисел допускаются служебные отметки NA / х / ? */
  allowMarks?: boolean;
  min?: number;
  max?: number;
  width?: number;
  fill?: string;        // ARGB заливки заголовка в шаблоне
}

// Служебные отметки из «РАЗЪЯСНЕНИЯ»: NA — неприменимо, х — неизвестно, ? — уточнить.
export const MARKS = ['NA', 'х', '?'];

const YES_NO_NA = ['0 - Нет', '1 - Да', 'NA'];
const PARK = 'FFFFFF00';
const RISK = 'FFC9DAF8';
const PRODROMAL = 'FFFFF2CC';

const num = (min: number, max: number) => ({ type: 'number' as const, allowMarks: true, min, max });
const year = num(1900, 2100);

export const DATASET_GROUPS = [
  'Субъект и запись',
  'Паркинсонизм',
  'УЗИ черной субстанции',
  'MoCA',
  'Общие сведения',
  'Факторы риска',
  'Продромальные симптомы',
  'Анамнез и комментарии',
] as const;

export const DATASET_FIELDS: DatasetField[] = [
  // ── Субъект и запись ──────────────────────────────────────────────────────
  { key: 'A', group: 'Субъект и запись', label: 'Номер субъекта', header: 'НОМЕР СУБЪЕКТА', type: 'text', width: 13 },
  { key: 'B', group: 'Субъект и запись', label: '№ записи субъекта', header: '# ЗАПИСИ СУБЪЕКТА', type: 'number', min: 1, max: 99, width: 7.88 },
  { key: 'C', group: 'Субъект и запись', label: 'Дата записи', header: 'ДАТА ЗАПИСИ', type: 'date', width: 13 },
  { key: 'D', group: 'Субъект и запись', label: 'Группа (Parkinsonism)', header: 'ГРУППА УЧАСТНИКА \nPARKINSONISM', type: 'select', width: 15.63,
    options: ['PU (undefined)', 'PP (prodroma)', 'P1 (early)', 'P2 (advanced)', 'PA (atypical)', 'SP (secondary)', 'C0 (without speech pathology)', 'C1 (with spech pathology)'] },
  { key: 'E', group: 'Субъект и запись', label: 'Группа (Dementia)', header: 'ГРУППА УЧАСТНИКА \nDEMENTIA', type: 'multiselect', width: 21.75,
    options: ['Norm', 'MCI', 'Dementia', 'Severe demetia', 'Subjective CI'] },
  { key: 'F', group: 'Субъект и запись', label: 'Вероятность', header: 'Вероятность', type: 'select', width: 15.63,
    options: ['Высокая', 'Умеренная', 'Низкая'] },
  { key: 'G', group: 'Субъект и запись', label: 'Возраст на момент записи', header: 'ВОЗРАСТ НА МОМЕНТ ЗАПИСИ (для всех групп)', ...num(0, 120) },
  { key: 'H', group: 'Субъект и запись', label: 'Пол', header: 'ПОЛ (для всех групп)', type: 'select', options: ['МУЖ', 'ЖЕН'] },
  { key: 'I', group: 'Субъект и запись', label: 'Заболевания, влияющие на речь', header: 'АССОЦИАЦИЯ С ЗАБОЛЕВАНИЯМИ, ПОТЕНЦИАЛЬНО ВЛИЯЮЩИМИ НА РЕЧЬ (для всех)', type: 'select', options: YES_NO_NA, fill: 'FFFFFFFF' },

  // ── Паркинсонизм ──────────────────────────────────────────────────────────
  { key: 'J', group: 'Паркинсонизм', label: 'Форма', header: 'ФОРМА (для пациентов с паркинсонизмом)', type: 'select', fill: PARK,
    options: ['Ригидная', 'Дрожательная', 'С постуральными нарушениями', 'NA'] },
  { key: 'K', group: 'Паркинсонизм', label: 'Стадия по Хен и Яр', header: 'СТАДИЯ ПО ХЕН И ЯР (для пациентов с паркинсонизмом)', type: 'select', fill: PARK,
    options: ['0', '1', '2', '3', '4', '5', 'NA'] },
  { key: 'L', group: 'Паркинсонизм', label: 'Год дебюта моторных симптомов', header: 'ГОД ДЕБЮТА МОТОРНЫХ СИМПТОМОВ (для пациентов с паркинсонизмом)', ...year, fill: PARK },
  { key: 'M', group: 'Паркинсонизм', label: 'Стаж болезни, лет', header: 'СТАЖ БОЛЕЗНИ НА МОМЕНТ ЗАПИСИ (для пациентов с паркинсонизмом)', ...num(0, 100), fill: PARK },
  { key: 'N', group: 'Паркинсонизм', label: 'Начало', header: 'НАЧАЛО (для пациентов с паркинсонизмом)', type: 'select', fill: PARK,
    options: ['Раннее', 'Позднее', 'NA'] },
  { key: 'O', group: 'Паркинсонизм', label: 'Леводопа', header: 'ЛЕВОДОПА (для пациентов с паркинсонизмом)', type: 'select', options: YES_NO_NA, fill: PARK },
  { key: 'P', group: 'Паркинсонизм', label: 'Год начала приёма леводопы', header: 'ГОД НАЧАЛА ПРИЕМА ЛЕВОДОПЫ (для пациентов с паркинсонизмом)', ...year, fill: PARK },
  { key: 'Q', group: 'Паркинсонизм', label: 'Суточная доза леводопы, мг', header: 'СУТ. ЛЕВОДОПА, МГ (для пациентов с паркинсонизмом)', ...num(0, 10000), fill: PARK },
  { key: 'R', group: 'Паркинсонизм', label: 'Разовая доза леводопы, мг', header: 'РАЗОВАЯ ДОЗА ЛЕВОДОПЫ, МГ (для пациентов с паркинсонизмом)', ...num(0, 5000), fill: PARK },
  { key: 'S', group: 'Паркинсонизм', label: 'Время от последней дозы, мин', header: 'ВРЕМЯ ОТ ПОСЛ ДОЗЫ, МИН (для пациентов с паркинсонизмом)', ...num(0, 100000), fill: PARK },
  { key: 'T', group: 'Паркинсонизм', label: 'Период', header: 'ПЕРИОД (для пациентов с паркинсонизмом)', type: 'select', fill: PARK,
    options: ['0 - Нет моторных флуктуаций', '1 - ВЫКЛ ', '2А - ВКЛ БЕЗ ДИСКИНЕЗИЙ', '2Б - ВКЛ С ДИСКИНЕЗИЯМИ', 'NA'] },
  { key: 'U', group: 'Паркинсонизм', label: 'Влияние леводопы на клинику', header: 'ПОТЕНЦИАЛЬНОЕ ВЛИЯНИЕ ЛЕВОДОПЫ НА КЛИНИКУ (для пациентов с паркинсонизмом) нет влияния, если не принимает, выключения или более 720 и больше минут', type: 'select', options: YES_NO_NA, fill: PARK },
  { key: 'V', group: 'Паркинсонизм', label: 'UPDRS (стар.)', header: 'UPDRS (СТАР) (для пациентов с паркинсонизмом)', ...num(0, 200), fill: PARK },
  { key: 'W', group: 'Паркинсонизм', label: 'UPDRS (обновл.)', header: 'UPDRS (ОБНОВЛ) (для пациентов с паркинсонизмом)', ...num(0, 200), fill: PARK },
  { key: 'X', group: 'Паркинсонизм', label: 'UPDRS без тремора (− 3.15–3.16)', header: 'UPDRS без учета баллов по тремору (для пациентов с паркинсонизмом) - вычетаем 3.15-3.16', ...num(0, 200), fill: PARK },

  // ── УЗИ ЧС ────────────────────────────────────────────────────────────────
  { key: 'Y', group: 'УЗИ черной субстанции', label: 'Гиперэхогенность (> 20 мм)', header: 'УЗИ ЧС больше 20мм, есть гиперэхогенность', type: 'select',
    options: ['0 - Нет гиперэхогенности (визуализация успешна)', '1 - Есть гиперэхогенность (визализация успешна)', 'NA (не проводилось или визуализация затруднена)'] },
  { key: 'Z',  group: 'УЗИ черной субстанции', label: 'Год УЗИ', header: 'УЗИ ЧС, год', ...year },
  { key: 'AA', group: 'УЗИ черной субстанции', label: 'Справа, мм²', header: 'УЗИ ЧС: справа (мм2)', ...num(0, 1000) },
  { key: 'AB', group: 'УЗИ черной субстанции', label: 'Слева, мм²', header: 'УЗИ ЧС: слева (мм2)', ...num(0, 1000) },
  { key: 'AC', group: 'УЗИ черной субстанции', label: '3-й желудочек, мм', header: 'УЗИ ЧС: 3 желудочек (мм)', ...num(0, 100) },

  // ── MoCA ──────────────────────────────────────────────────────────────────
  { key: 'AD', group: 'MoCA', label: 'MoCA проводилась', header: 'MOCA (Да/Нет)', type: 'select', options: YES_NO_NA, width: 9.38 },
  { key: 'AE', group: 'MoCA', label: 'Вариант MoCA', header: 'MOCA вариант', ...num(1, 3) },
  { key: 'AF', group: 'MoCA', label: 'Годы / образование', header: 'Годы / образование', type: 'text' },
  { key: 'AG', group: 'MoCA', label: 'Тест 1 (альтернирующий путь)', header: 'МОСА: Тест 1 (альтернирующего пути)', ...num(0, 1) },
  { key: 'AH', group: 'MoCA', label: 'Тест 2 (куб)', header: 'МОСА: Тест 2 (куб)', ...num(0, 1) },
  { key: 'AI', group: 'MoCA', label: 'Тест 3 (часы)', header: 'МОСА: Тест 3 (часы)', ...num(0, 3) },
  { key: 'AJ', group: 'MoCA', label: 'Тест 4 (называние животных)', header: 'МОСА: Тест 4 (называние животных)', ...num(0, 3) },
  { key: 'AK', group: 'MoCA', label: '5 слов — попытка 1', header: 'МОСА: 5 слов немедленное воспроизведение - 1 попытка', ...num(0, 5) },
  { key: 'AL', group: 'MoCA', label: '5 слов — попытка 2', header: 'МОСА: 5 слов немедленное воспроизведение - 2 попытка', ...num(0, 5) },
  { key: 'AM', group: 'MoCA', label: 'Тест 5 (цифры)', header: 'МОСА: Тест 5 (повтор цифр в прямом и обратном порядке)', ...num(0, 2) },
  { key: 'AN', group: 'MoCA', label: 'Тест 6 (тап-тест «А»)', header: 'МОСА: Тест 6 (тап-тест на букву А)', ...num(0, 1) },
  { key: 'AO', group: 'MoCA', label: 'Тест 7 (вычитание 7)', header: 'МОСА: Тест 7 (вычитание 7)', ...num(0, 3) },
  { key: 'AP', group: 'MoCA', label: 'Тест 8 (повторение предложений)', header: 'МОСА: Тест 8 (повторение предложений)', ...num(0, 2) },
  { key: 'AQ', group: 'MoCA', label: 'Тест 9 (слова на К/Л)', header: 'МОСА: Тест 9 (называние слов на  букву К или Л)', ...num(0, 1) },
  { key: 'AR', group: 'MoCA', label: 'Тест 10 (абстракция)', header: 'МОСА: Тест 10 (абстрактные категории - схожесть)', ...num(0, 2) },
  { key: 'AS', group: 'MoCA', label: 'Тест 11 (отсроченное воспроизведение)', header: 'МОСА: Тест 11 (отсроченное воспроизведение 5 слов)', ...num(0, 5) },
  { key: 'AT', group: 'MoCA', label: 'Тест 12 (ориентирование)', header: 'МОСА: Тест 12 (ориентирование во времени и месте)', ...num(0, 6) },
  { key: 'AU', group: 'MoCA', label: 'ТРЧ (из 10)', header: 'ТРЧ (баллы из 10)', ...num(0, 10) },
  { key: 'AV', group: 'MoCA', label: 'MoCA: Total', header: 'MOCA: Total', ...num(0, 30) },

  // ── Общие сведения ────────────────────────────────────────────────────────
  { key: 'AW', group: 'Общие сведения', label: 'Генетический риск БП', header: 'Генетический риск БП', type: 'select',
    options: ['Не проводился', 'GBA - да', 'LRRK2 - да', 'Полигенный риск - да', 'Проводился: отрицательно'] },
  { key: 'AX', group: 'Общие сведения', label: 'Язык', header: 'ЯЗЫК', type: 'select',
    options: ['Русский', 'Татарский', 'Русский / Татарский', 'Татарский/русский', 'Русский / Другой', 'Другой', 'Не указан'] },
  { key: 'AY', group: 'Общие сведения', label: 'Субъективное изменение голоса', header: 'Субъективное изменение голоса', type: 'select',
    options: ['0 - Нет', '1 - Да', 'Не знаю', 'NA'] },

  // ── Факторы риска ─────────────────────────────────────────────────────────
  { key: 'AZ', group: 'Факторы риска', label: 'Пестициды', header: '1. Подвергались ли Вы регулярному воздействию пестицидов?\n(т.е. ≥100 эпизодов непрофессионального воздействия)', type: 'select', options: YES_NO_NA, fill: RISK, width: 18.5 },
  { key: 'BA', group: 'Факторы риска', label: 'Растворители', header: '2. Подвергались ли Вы регулярному воздействию растворителей? \n(в рамках профессиональной деятельности)\n', type: 'select', options: YES_NO_NA, fill: RISK },
  { key: 'BB', group: 'Факторы риска', label: 'Кофе > 3 / чай > 6 чашек в неделю', header: '3. Вы употребляете более 3 чашек кофе в неделю или более 6 чашек чая в неделю\n', type: 'select', options: YES_NO_NA, fill: RISK },
  { key: 'BC', group: 'Факторы риска', label: 'Курение', header: '4. Вы курите?\n', type: 'select', fill: RISK,
    options: ['0 - Курю  ', '1 - Раньше курил/-а ', '2 - Никогда не курил /-а', 'NA'] },
  { key: 'BD', group: 'Факторы риска', label: 'Родственник 1 линии с БП', header: '5.  Есть ли у Вас родственник 1 линии (мама, папа, брат / сестра) с болезнью Паркинсона?\n', type: 'select', options: YES_NO_NA, fill: RISK },
  { key: 'BE', group: 'Факторы риска', label: 'Спорт > 1 ч в неделю', header: '6. Занимаетесь ли Вы спортом целенаправленно более 1 часа в неделю (занятия с кардионагрузкой и высоким пульсом)?\n', type: 'select', options: YES_NO_NA, fill: RISK },
  { key: 'BF', group: 'Факторы риска', label: 'Сахарный диабет 2 типа', header: '7. Есть ли у вас выставленный диагноз САХАРАНОГО ДИАБЕТА 2 ТИПА? ', type: 'select', options: YES_NO_NA, fill: RISK },

  // ── Продромальные симптомы (вопрос + год появления) ──────────────────────
  { key: 'BG', group: 'Продромальные симптомы', label: 'Нарушение поведения во сне', header: '1. Бывает ли, что Вы во сне разговариваете, кричите, деретесь или машете руками и ногами?  \n', type: 'select', options: YES_NO_NA, fill: PRODROMAL },
  { key: 'BH', group: 'Продромальные симптомы', label: '↳ год появления', header: '1. Год появления', ...year, fill: PRODROMAL },
  { key: 'BI', group: 'Продромальные симптомы', label: 'Запоры', header: '2. Бывают ли у Вас запоры (реже 1 раза в 3 дня)?', type: 'select', options: YES_NO_NA, fill: PRODROMAL },
  { key: 'BJ', group: 'Продромальные симптомы', label: '↳ год появления', header: '2. Год появления', ...year, fill: PRODROMAL },
  { key: 'BK', group: 'Продромальные симптомы', label: 'Хорошо чувствует запахи', header: '3. Вы хорошо чувствуете запахи?\n', type: 'select', options: YES_NO_NA, fill: PRODROMAL },
  { key: 'BL', group: 'Продромальные симптомы', label: '↳ год появления', header: '3. Год появления', ...year, fill: PRODROMAL },
  { key: 'BM', group: 'Продромальные симптомы', label: 'Внезапные засыпания днём', header: '4. Бывает ли, что внезапно засыпаете днем? ', type: 'select', options: YES_NO_NA, fill: PRODROMAL },
  { key: 'BN', group: 'Продромальные симптомы', label: '↳ год появления', header: '4. Год появления\n', ...year, fill: PRODROMAL },
  { key: 'BO', group: 'Продромальные симптомы', label: 'Депрессия / сниженное настроение', header: '5.  Есть ли у Вас депрессия / сниженное настроение?', type: 'select', options: YES_NO_NA, fill: PRODROMAL },
  { key: 'BP', group: 'Продромальные симптомы', label: '↳ год появления', header: '5. Год появления', ...year, fill: PRODROMAL },
  { key: 'BQ', group: 'Продромальные симптомы', label: 'Проблемы с мочеиспусканием', header: '6. Есть ли у Вас проблемы с мочеиспусканием?\n', type: 'select', options: YES_NO_NA, fill: PRODROMAL },
  { key: 'BR', group: 'Продромальные симптомы', label: '↳ год появления', header: '6. Год появления\n', ...year, fill: PRODROMAL },
  { key: 'BS', group: 'Продромальные симптомы', label: 'Ортостатические головокружения', header: '7. Бывают ли у Вас головокружения из-за низкого артериального давления / когда встаете с кровати?', type: 'select', options: YES_NO_NA, fill: PRODROMAL },
  { key: 'BT', group: 'Продромальные симптомы', label: '↳ год появления', header: '7. Год появления\n', ...year, fill: PRODROMAL },

  // ── Анамнез и комментарии ─────────────────────────────────────────────────
  { key: 'BU', group: 'Анамнез и комментарии', label: 'Сопутствующие заболевания', header: 'Сопутствующие заболевания', type: 'textarea' },
  { key: 'BV', group: 'Анамнез и комментарии', label: 'Постоянно принимаемые препараты', header: 'Постоянно принимаемые препараты', type: 'textarea' },
  { key: 'BW', group: 'Анамнез и комментарии', label: 'Комментарии', header: 'КОММЕНТАРИИ (для всех групп)', type: 'textarea', width: 75.75 },
];

/**
 * Блок «АУДИОЗАПИСИ» (BZ…CE) — порядковые номера аудиофайлов из «РАЗЪЯСНЕНИЙ»:
 * 1 — «Гималайский медведь», 2 — долгая «а», 3 — «о-и», 4 — «Вор печенья».
 * Слоты 5–6 есть в шаблоне, но заданий для них в приложении пока нет.
 * CF — комментарий к записям (в шаблоне: формат, язык и т.п.).
 */
export const AUDIO_SLOTS: { key: string; slot: number; label: string; taskTypes: string[] }[] = [
  { key: 'BZ', slot: 1, label: '1 — чтение «Гималайский медведь»', taskTypes: ['SP-READ'] },
  { key: 'CA', slot: 2, label: '2 — долгая «а»',                    taskTypes: ['PH-A'] },
  { key: 'CB', slot: 3, label: '3 — «ооо-иии»',                     taskTypes: ['PH-OI'] },
  { key: 'CC', slot: 4, label: '4 — описание картинки',             taskTypes: ['SP-PIC'] },
  { key: 'CD', slot: 5, label: '5',                                 taskTypes: [] },
  { key: 'CE', slot: 6, label: '6',                                 taskTypes: [] },
];
export const AUDIO_NOTE_KEY = 'CF';

const FIELD_BY_KEY = new Map(DATASET_FIELDS.map((f) => [f.key, f]));
const MAX_TEXT = 2000;

export type AnnotationValues = Record<string, string>;

/**
 * Проверить и нормализовать значения разметки. Неизвестные ключи отбрасываются,
 * значения вне списков/диапазонов — ошибка (данные идут в обучающий датасет).
 */
export function validateAnnotation(input: unknown): { values: AnnotationValues; errors: Record<string, string> } {
  const values: AnnotationValues = {};
  const errors: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { values, errors: { _: 'Некорректный формат данных' } };
  }

  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const field = FIELD_BY_KEY.get(key);
    if (!field && key !== AUDIO_NOTE_KEY) continue;
    if (raw === null || raw === undefined) continue;
    if (typeof raw !== 'string' && typeof raw !== 'number') { errors[key] = 'Некорректное значение'; continue; }
    const v = String(raw).slice(0, MAX_TEXT);
    if (v.trim() === '') continue;

    if (!field) { values[key] = v; continue; } // CF — свободный комментарий

    switch (field.type) {
      case 'select':
        if (!field.options!.includes(v)) errors[key] = 'Значение не из списка';
        else values[key] = v;
        break;
      case 'multiselect': {
        const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
        if (!parts.length || parts.some((p) => !field.options!.includes(p))) errors[key] = 'Значение не из списка';
        else values[key] = Array.from(new Set(parts)).join(', ');
        break;
      }
      case 'number': {
        const t = v.trim();
        if (field.allowMarks && MARKS.includes(t)) { values[key] = t; break; }
        const n = Number(t.replace(',', '.'));
        if (!Number.isFinite(n)) errors[key] = field.allowMarks ? 'Число или NA / х / ?' : 'Нужно число';
        else if ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) {
          errors[key] = `Допустимо ${field.min}–${field.max}`;
        } else values[key] = String(n);
        break;
      }
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) errors[key] = 'Дата в формате ГГГГ-ММ-ДД';
        else values[key] = v;
        break;
      default:
        values[key] = v;
    }
  }
  return { values, errors };
}
