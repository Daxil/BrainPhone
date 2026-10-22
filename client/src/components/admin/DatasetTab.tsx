import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Download, Trash2, AlertTriangle, CheckCircle2, FileAudio, Wand2 } from 'lucide-react';
import {
  datasetApi,
  type AnnotationValues,
  type DatasetAudio,
  type DatasetField,
  type DatasetRecord,
  type DatasetSchema,
  type DatasetSubject,
} from '../../services/datasetApi';

type Filter = 'all' | 'todo' | 'draft' | 'complete';

const MOCA_SCORE_KEYS = ['AG', 'AH', 'AI', 'AJ', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT'];

const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('ru-RU') : '—');
const fmtSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`);

function subjectStatus(s: DatasetSubject): Exclude<Filter, 'all'> {
  if (!s.annotation) return 'todo';
  return s.annotation.isComplete ? 'complete' : 'draft';
}

const STATUS_BADGE: Record<Exclude<Filter, 'all'>, { text: string; cls: string }> = {
  todo:     { text: 'Не размечено', cls: 'bg-gray-100 text-gray-600' },
  draft:    { text: 'Черновик',     cls: 'bg-amber-100 text-amber-700' },
  complete: { text: 'Размечено',    cls: 'bg-green-100 text-green-700' },
};

/** Подсказки-вычисления по правилам из шаблона (лист «Логика решений», «РАСЧЕТ МоСА»). */
function derived(values: AnnotationValues): AnnotationValues {
  const out: AnnotationValues = {};
  const nums = MOCA_SCORE_KEYS.map((k) => Number(values[k]));
  if (nums.every(Number.isFinite)) {
    out.AV = String(nums.reduce((a, b) => a + b, 0));
  }
  const onset = Number(values.L);
  if (values.C && Number.isInteger(onset) && onset > 1900) {
    out.M = String(Number(values.C.slice(0, 4)) - onset);
  }
  // Влияние леводопы: «нет», если не принимает, период ВЫКЛ или ≥ 720 мин от дозы.
  if (values.D?.startsWith('C')) out.U = 'NA';
  else if (values.O === '0 - Нет' || values.T?.startsWith('1 - ВЫКЛ') || Number(values.S) >= 720) out.U = '0 - Нет';
  else if (values.O === '1 - Да' || Number.isFinite(Number(values.S))) out.U = '1 - Да';
  return out;
}

// ─── Просмотр анкеты (произвольный JSON) ─────────────────────────────────────

function KeyValue({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null || data === undefined || data === '') return <span className="text-gray-400">—</span>;
  if (typeof data !== 'object') return <span className="text-gray-800 break-words">{String(data)}</span>;
  const entries = Array.isArray(data) ? data.map((v, i) => [String(i + 1), v] as const) : Object.entries(data as Record<string, unknown>);
  const shown = entries.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!shown.length) return <span className="text-gray-400">—</span>;
  return (
    <dl className={`grid grid-cols-[minmax(120px,40%)_1fr] gap-x-3 gap-y-1 ${depth ? 'pl-3 border-l border-gray-200' : ''}`}>
      {shown.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-gray-500 font-mono text-xs pt-0.5 break-all">{k}</dt>
          <dd className="text-sm"><KeyValue data={v} depth={depth + 1} /></dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Поле формы ──────────────────────────────────────────────────────────────

function FieldInput({ field, value, onChange, error, hint, marks }: {
  field: DatasetField;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  marks: string[];
}) {
  const base = `w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-400' : 'border-gray-300'}`;
  let input: JSX.Element;

  if (field.type === 'select') {
    input = (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">—</option>
        {field.options!.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else if (field.type === 'multiselect') {
    const selected = new Set(value ? value.split(',').map((s) => s.trim()) : []);
    input = (
      <div className="flex flex-wrap gap-1.5">
        {field.options!.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => {
              const next = new Set(selected);
              if (next.has(o)) next.delete(o); else next.add(o);
              onChange(field.options!.filter((x) => next.has(x)).join(', '));
            }}
            className={`px-2 py-1 rounded-md text-xs border ${selected.has(o) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {o}
          </button>
        ))}
      </div>
    );
  } else if (field.type === 'textarea') {
    input = <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} maxLength={2000} className={base} />;
  } else if (field.type === 'date') {
    input = <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={base} />;
  } else if (field.type === 'number') {
    input = (
      <div className="flex gap-1">
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className={base}
          placeholder={field.min !== undefined ? `${field.min}–${field.max}` : ''} />
        {field.allowMarks && marks.map((m) => (
          <button key={m} type="button" onClick={() => onChange(m)} title="Служебная отметка"
            className={`px-1.5 rounded-md text-xs border ${value === m ? 'bg-gray-700 border-gray-700 text-white' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
            {m}
          </button>
        ))}
      </div>
    );
  } else {
    input = <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={200} className={base} />;
  }

  return (
    <label className={`block ${field.type === 'textarea' || field.type === 'multiselect' ? 'sm:col-span-2' : ''}`}>
      <span className="flex items-center gap-1.5 text-xs text-gray-600 mb-1" title={field.header}>
        <span className="font-mono text-gray-400">{field.key}</span>
        <span className="truncate">{field.label}</span>
        {hint !== undefined && hint !== value && (
          <button type="button" onClick={(e) => { e.preventDefault(); onChange(hint); }}
            className="ml-auto flex items-center gap-0.5 text-blue-600 hover:underline flex-shrink-0" title="Подставить расчётное значение">
            <Wand2 className="w-3 h-3" />{hint}
          </button>
        )}
      </span>
      {input}
      {error && <span className="block text-xs text-red-600 mt-0.5">{error}</span>}
    </label>
  );
}

// ─── Подтверждение удаления (step-up) ────────────────────────────────────────

function DeleteAudioModal({ audio, needTotp, onClose, onDeleted }: {
  audio: DatasetAudio;
  needTotp: boolean;
  onClose: () => void;
  onDeleted: (trashed: boolean) => void;
}) {
  const [confirmWord, setConfirmWord] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    // Токен не храним между удалениями: каждое удаление — отдельное подтверждение паролем.
    const step = await datasetApi.stepUp(password, needTotp ? totp : undefined);
    setPassword('');
    if (!step.ok || !step.data) { setError(step.error || 'Не удалось подтвердить'); setBusy(false); return; }
    const del = await datasetApi.deleteAudio(audio.key, audio.fileName, step.data.token);
    setBusy(false);
    if (!del.ok) { setError(del.error || 'Не удалось удалить'); return; }
    onDeleted(!!del.data?.trashed);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Удалить аудиозапись?</h2>
            <p className="text-sm text-gray-500 mt-1 break-all">{audio.fileName}</p>
            <p className="text-xs text-gray-500 mt-2">
              Файл будет удалён из хранилища и из базы. Действие записывается в журнал аудита.
            </p>
          </div>
        </div>
        <label className="block text-sm">
          <span className="text-gray-700">Введите <b>УДАЛИТЬ</b> для подтверждения</span>
          <input value={confirmWord} onChange={(e) => setConfirmWord(e.target.value)} autoFocus
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Ваш пароль</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        {needTotp && (
          <label className="block text-sm">
            <span className="text-gray-700">Код 2FA</span>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest" />
          </label>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium">
            Отмена
          </button>
          <button type="submit"
            disabled={busy || confirmWord !== 'УДАЛИТЬ' || !password || (needTotp && totp.length !== 6)}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium disabled:bg-gray-200 disabled:text-gray-400">
            {busy ? 'Удаление...' : 'Удалить'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Карточка кейса ──────────────────────────────────────────────────────────

function RecordPanel({ schema, patientId, onSaved, onDirtyChange, onAudioDeleted }: {
  schema: DatasetSchema;
  patientId: string;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onAudioDeleted: () => void;
}) {
  const [record, setRecord] = useState<DatasetRecord | null>(null);
  const [values, setValues] = useState<AnnotationValues>({});
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<DatasetAudio | null>(null);

  const load = async () => {
    setLoadError('');
    const r = await datasetApi.record(patientId);
    if (!r.ok || !r.data) { setLoadError(r.error || 'Ошибка загрузки'); return; }
    const rec = r.data.record;
    setRecord(rec);
    // Без сохранённой разметки стартуем с подсказок из анкеты кейса.
    setValues(rec.annotation ? { ...rec.annotation.data } : { ...rec.suggested });
    setDirty(false);
    setFieldErrors({});
    setSaveMsg(null);
  };

  useEffect(() => { setRecord(null); load(); }, [patientId]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty]);

  const hints = useMemo(() => derived(values), [values]);

  const setField = (key: string, v: string) => {
    setValues((prev) => {
      const next = { ...prev };
      if (v === '') delete next[key]; else next[key] = v;
      return next;
    });
    setDirty(true);
    setFieldErrors((prev) => { const { [key]: _drop, ...rest } = prev; return rest; });
  };

  const fillFromSuggested = () => {
    if (!record) return;
    setValues((prev) => ({ ...record.suggested, ...prev }));
    setDirty(true);
  };

  const save = async (complete: boolean) => {
    if (!record) return;
    setSaving(true);
    setSaveMsg(null);
    const r = await datasetApi.saveAnnotation(patientId, values, complete, record.annotation?.version ?? null);
    setSaving(false);
    if (!r.ok || !r.data) {
      setFieldErrors(r.fieldErrors || {});
      setSaveMsg({ ok: false, text: r.error || 'Ошибка сохранения' });
      return;
    }
    const a = r.data.annotation;
    setRecord({ ...record, annotation: { ...a, annotatedBy: null } });
    setValues(a.data);
    setDirty(false);
    setSaveMsg({ ok: true, text: complete ? 'Разметка сохранена как завершённая' : 'Черновик сохранён' });
    onSaved();
  };

  if (loadError) return <div className="p-6 text-sm text-red-600">{loadError}</div>;
  if (!record) return <div className="p-6 text-sm text-gray-400">Загрузка…</div>;

  const p = record.patient;
  const groups = schema.groups.map((g) => ({ name: g, fields: schema.fields.filter((f) => f.group === g) }));

  return (
    <div className="space-y-4">
      {/* Шапка */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="font-semibold text-gray-900">
              {(p?.case_number as string) || record.patientId}
              {record.annotation && (
                <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${record.annotation.isComplete ? STATUS_BADGE.complete.cls : STATUS_BADGE.draft.cls}`}>
                  {record.annotation.isComplete ? 'Размечено' : 'Черновик'}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 font-mono break-all">{record.patientId}</div>
            {p ? (
              <div className="text-xs text-gray-500 mt-1">
                {fmtDate(p.created_at as string)} · {String(p.protocol_type ?? '—')} · {String(p.case_status ?? '—')} · врач: {String(p.doctor_email ?? '—')}
              </div>
            ) : (
              <div className="text-xs text-amber-700 mt-1">Кейса нет в базе — данные только из S3</div>
            )}
          </div>
          {record.annotation?.updatedAt && (
            <div className="text-xs text-gray-400">
              изменено {new Date(record.annotation.updatedAt).toLocaleString('ru-RU')}
              {record.annotation.annotatedBy ? ` · ${record.annotation.annotatedBy}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Аудио */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3 text-sm">Аудиозаписи ({record.audio.length})</h3>
        {record.audio.length === 0 && <p className="text-sm text-gray-400">Нет аудиозаписей</p>}
        <div className="space-y-3">
          {record.audio.map((a) => (
            <div key={a.key} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-gray-900 flex items-center gap-1.5">
                    <FileAudio className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {schema.audioSlots.find((s) => s.taskTypes.includes(a.recordingType))?.label || a.label || a.recordingType || 'Запись'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 break-all">
                    {a.fileName} · {fmtSize(a.sizeBytes)}{a.duration ? ` · ${a.duration.toFixed(1)} с` : ''} · {fmtDate(a.uploadedAt)}
                  </div>
                  {a.datasetName && <div className="text-xs text-gray-500">В датасете: <span className="font-mono">{a.datasetName}</span></div>}
                  {!a.inS3 && <div className="text-xs text-red-600">Файла нет в S3 (только запись в БД)</div>}
                  {!a.inDb && <div className="text-xs text-amber-700">Файл есть в S3, но не привязан в БД</div>}
                </div>
                <button onClick={() => setToDelete(a)} title="Удалить запись"
                  className="text-red-600 hover:bg-red-50 rounded-lg p-1.5 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {a.url && <audio controls preload="none" src={a.url} className="w-full mt-2 h-9" />}
            </div>
          ))}
        </div>
      </div>

      {/* Анкета */}
      <details className="bg-white rounded-xl border border-gray-200 p-4">
        <summary className="font-semibold text-gray-900 text-sm cursor-pointer">Данные пациента и анкеты</summary>
        <div className="mt-3 space-y-4">
          {p && <div><div className="text-xs font-medium text-gray-500 mb-1">Кейс (БД)</div><KeyValue data={p} /></div>}
          {record.consent && <div><div className="text-xs font-medium text-gray-500 mb-1">Согласие</div><KeyValue data={record.consent} /></div>}
          {record.questionnaire != null && (
            <div><div className="text-xs font-medium text-gray-500 mb-1">Анкета из S3 (data.json)</div><KeyValue data={record.questionnaire} /></div>
          )}
          {!p && record.questionnaire == null && <p className="text-sm text-gray-400">Анкета не найдена</p>}
        </div>
      </details>

      {/* Разметка */}
      {record.patientId !== '__unmatched__' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between gap-2 p-4 border-b border-gray-100 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-sm">Разметка (лист «Субъекты Р и С - НОВЫЕ»)</h3>
            {Object.keys(record.suggested).length > 0 && (
              <button onClick={fillFromSuggested} className="text-xs text-blue-600 hover:underline">
                Дополнить пустые поля из анкеты
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {groups.map((g, gi) => (
              <details key={g.name} open={gi < 2} className="p-4">
                <summary className="text-sm font-medium text-gray-800 cursor-pointer">
                  {g.name}
                  <span className="ml-2 text-xs text-gray-400">
                    {g.fields.filter((f) => values[f.key]).length}/{g.fields.length}
                  </span>
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {g.fields.map((f) => (
                    <FieldInput key={f.key} field={f} value={values[f.key] ?? ''} onChange={(v) => setField(f.key, v)}
                      error={fieldErrors[f.key]} hint={hints[f.key]} marks={schema.marks} />
                  ))}
                </div>
              </details>
            ))}
            <div className="p-4">
              <label className="block">
                <span className="text-xs text-gray-600"><span className="font-mono text-gray-400">{schema.audioNoteKey}</span> Комментарий к аудиозаписям</span>
                <input value={values[schema.audioNoteKey] ?? ''} onChange={(e) => setField(schema.audioNoteKey, e.target.value)} maxLength={500}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm" placeholder="например: формат FLAC, 4 - тат" />
              </label>
              <p className="text-xs text-gray-400 mt-2">
                Колонки «АУДИОЗАПИСИ» (1–6) в выгрузке заполняются автоматически по файлам кейса в S3.
              </p>
            </div>
          </div>
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3 flex items-center gap-2 flex-wrap rounded-b-xl">
            {saveMsg && (
              <span className={`text-sm mr-auto ${saveMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{saveMsg.text}</span>
            )}
            {!saveMsg && dirty && <span className="text-xs text-amber-600 mr-auto">Есть несохранённые изменения</span>}
            <button disabled={saving} onClick={() => save(false)}
              className="ml-auto px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Сохранить черновик
            </button>
            <button disabled={saving} onClick={() => save(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> {saving ? 'Сохранение…' : 'Разметка завершена'}
            </button>
          </div>
        </div>
      )}

      {toDelete && (
        <DeleteAudioModal
          audio={toDelete}
          needTotp={schema.stepUpRequiresTotp}
          onClose={() => setToDelete(null)}
          onDeleted={(trashed) => {
            setToDelete(null);
            setSaveMsg({ ok: true, text: trashed ? 'Запись удалена (копия в корзине хранилища)' : 'Запись удалена' });
            setRecord((r) => r && { ...r, audio: r.audio.filter((x) => x.key !== toDelete.key) });
            onAudioDeleted();
          }}
        />
      )}
    </div>
  );
}

// ─── Вкладка ─────────────────────────────────────────────────────────────────

export default function DatasetTab() {
  const [schema, setSchema] = useState<DatasetSchema | null>(null);
  const [subjects, setSubjects] = useState<DatasetSubject[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [s3Configured, setS3Configured] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dirtyRef = useRef(false);

  const loadList = async (refresh = false) => {
    setLoading(true);
    const r = await datasetApi.records(refresh);
    setLoading(false);
    if (!r.ok || !r.data) { setError(r.error || 'Ошибка загрузки'); return; }
    setError('');
    setSubjects(r.data.records);
    setSyncedAt(r.data.syncedAt);
    setS3Configured(r.data.s3Configured);
  };

  useEffect(() => {
    datasetApi.schema().then((r) => {
      if (r.ok && r.data) setSchema(r.data.schema); else setError(r.error || 'Ошибка загрузки схемы');
    });
    loadList();
  }, []);

  // Не теряем несохранённую разметку при закрытии вкладки браузера.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const select = (id: string) => {
    if (id === selected) return;
    if (dirtyRef.current && !window.confirm('Есть несохранённые изменения разметки. Перейти без сохранения?')) return;
    dirtyRef.current = false;
    setSelected(id);
  };

  const counts = useMemo(() => {
    const c = { all: subjects.length, todo: 0, draft: 0, complete: 0 };
    for (const s of subjects) c[subjectStatus(s)]++;
    return c;
  }, [subjects]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subjects.filter((s) => {
      if (filter !== 'all' && subjectStatus(s) !== filter) return false;
      if (!q) return true;
      return [s.patientId, s.caseNumber, s.annotation?.subjectCode, s.doctorEmail]
        .some((v) => v && v.toLowerCase().includes(q));
    });
  }, [subjects, filter, query]);

  const handleExport = async () => {
    setExporting(true);
    const r = await datasetApi.downloadExport(includeDrafts);
    setExporting(false);
    if (!r.ok) setError(r.error || 'Ошибка выгрузки');
  };

  return (
    <div className="space-y-4">
      {/* Панель действий */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 flex-wrap">
        <div className="text-sm text-gray-600 mr-auto">
          Всего <b>{counts.all}</b> · размечено <b className="text-green-700">{counts.complete}</b> · черновиков <b className="text-amber-700">{counts.draft}</b> · без разметки <b>{counts.todo}</b>
          {syncedAt && <div className="text-xs text-gray-400">S3 синхронизировано {new Date(syncedAt).toLocaleTimeString('ru-RU')}</div>}
        </div>
        <button onClick={() => loadList(true)} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Обновить из S3
        </button>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} />
          включая черновики
        </label>
        <button onClick={handleExport} disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50">
          <Download className="w-4 h-4" /> {exporting ? 'Формирование…' : 'Скачать XLSX'}
        </button>
      </div>

      {!s3Configured && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-2">
          S3 не настроен на сервере — показаны только записи из базы данных.
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 items-start">
        {/* Список кейсов */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden md:sticky md:top-4">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск: номер, ID, врач"
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-1 flex-wrap">
              {(['all', 'todo', 'draft', 'complete'] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-2 py-1 rounded-md text-xs ${filter === f ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {f === 'all' ? 'Все' : STATUS_BADGE[f].text} ({counts[f]})
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-100">
            {visible.map((s) => {
              const st = STATUS_BADGE[subjectStatus(s)];
              const missing = s.audio.some((a) => !a.inS3);
              return (
                <button key={s.patientId} onClick={() => select(s.patientId)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 ${selected === s.patientId ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {s.patientId === '__unmatched__' ? 'Файлы без кейса' : s.annotation?.subjectCode || s.caseNumber || s.patientId.slice(-10)}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${st.cls}`}>{st.text}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex gap-2">
                    <span>{fmtDate(s.createdAt ?? s.audio[0]?.uploadedAt)}</span>
                    <span>{s.audio.length} ауд.</span>
                    {s.age && <span>{s.age} · {s.gender === 'male' ? 'М' : s.gender === 'female' ? 'Ж' : '—'}</span>}
                    {!s.inDb && <span className="text-amber-700">только S3</span>}
                    {missing && <span className="text-red-600">нет файла</span>}
                  </div>
                </button>
              );
            })}
            {visible.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">{loading ? 'Загрузка…' : 'Ничего не найдено'}</div>
            )}
          </div>
        </div>

        {/* Карточка */}
        <div>
          {schema && selected ? (
            <RecordPanel
              key={selected}
              schema={schema}
              patientId={selected}
              onDirtyChange={(d) => { dirtyRef.current = d; }}
              onSaved={() => loadList()}
              onAudioDeleted={() => loadList()}
            />
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
              Выберите кейс слева, чтобы прослушать аудио и разметить данные
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
