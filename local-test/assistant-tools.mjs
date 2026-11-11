/** Explicit proposal contract shared by the model boundary and the review UI. No arbitrary JS. */
export const designKeys = [
  'displayMode',
  'schoolName',
  'loopSchoolName',
  'background',
  'color',
  'accent',
  'fontSize',
  'loopHidePhoto',
  'showTechQuotes',
];
const limits = { title: 100, subtitle: 160, body: 700, badge: 100, footer: 160 };
export function contentPatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid content');
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(limits, key) || typeof value !== 'string' || value.length > limits[key])
      throw Error('Unsupported content field: ' + key);
    result[key] = value;
  }
  return result;
}
export function validateProposal(value, admin = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid proposal');
  const allowed = [
    'summary',
    'schedule',
    'design',
    'content',
    'periods',
    'refreshSeconds',
    'clockTextScale',
    'boardTextScale',
  ];
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw Error('Unsupported change');
  if (typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 1000)
    throw Error('Missing change summary');
  const proposal = { summary: value.summary };
  if (value.schedule !== undefined) {
    if (!Array.isArray(value.schedule) || !value.schedule.length || value.schedule.length > 7)
      throw Error('اختر من يوم إلى سبعة أيام للإذاعة');
    const dates = new Set();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
    proposal.schedule = value.schedule
      .map((entry) => {
        if (!entry || Object.keys(entry).some((key) => !['date', 'content'].includes(key)))
          throw Error('Invalid broadcast entry');
        const date = entry.date;
        if (
          typeof date !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          date <= today ||
          !Number.isFinite(Date.parse(date + 'T12:00:00Z')) ||
          new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date ||
          dates.has(date)
        )
          throw Error('أدخل تواريخ مستقبلية صحيحة وغير مكررة للإذاعة');
        dates.add(date);
        const content = contentPatch(entry.content);
        if (!content.title?.trim()) throw Error('كل يوم إذاعي يحتاج عنوانًا');
        return { date, content: { subtitle: '', body: '', badge: '', footer: '', ...content } };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  if (value.design !== undefined) {
    if (!admin) throw Error('Design changes require administrator access');
    if (
      !value.design ||
      typeof value.design !== 'object' ||
      Array.isArray(value.design) ||
      !Object.keys(value.design).length
    )
      throw Error('Invalid design');
    const design = {};
    for (const [key, field] of Object.entries(value.design)) {
      if (!designKeys.includes(key)) throw Error('Unsupported design field');
      if (['background', 'color', 'accent'].includes(key)) {
        if (typeof field !== 'string' || !/^#[a-f0-9]{6}$/i.test(field))
          throw Error('Invalid design color');
      } else if (key === 'displayMode') {
        if (!['daily', 'loop'].includes(field)) throw Error('Choose daily or loop display');
      } else if (key === 'fontSize') {
        if (!Number.isFinite(field) || field < 60 || field > 180) throw Error('Invalid text size');
      } else if (['loopHidePhoto', 'showTechQuotes'].includes(key)) {
        if (typeof field !== 'boolean') throw Error('Invalid design option');
      } else if (typeof field !== 'string' || field.length > 160)
        throw Error('Invalid school name');
      design[key] = field;
    }
    proposal.design = design;
  }
  if (value.content) proposal.content = contentPatch(value.content);
  for (const key of ['periods', 'refreshSeconds', 'clockTextScale', 'boardTextScale']) {
    if (value[key] === undefined) continue;
    if (!admin) throw Error('Design changes require administrator access');
    if (key === 'periods') {
      if (!Array.isArray(value.periods) || value.periods.length !== 7)
        throw Error('Exactly seven periods are required');
      let end = '';
      for (const period of value.periods) {
        if (
          !Array.isArray(period) ||
          period.length !== 2 ||
          period.some(
            (time) => typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time),
          ) ||
          period[0] >= period[1] ||
          period[0] < end
        )
          throw Error('Periods must be valid, ordered and non-overlapping');
        end = period[1];
      }
    } else if (key === 'refreshSeconds') {
      if (![30, 60, 120, 300].includes(value[key])) throw Error('Unsupported refresh interval');
    } else if (typeof value[key] !== 'number' || value[key] < 0.75 || value[key] > 2)
      throw Error('Text scale must be between 0.75 and 2');
    proposal[key] = value[key];
  }
  if (Object.keys(proposal).length < 2) throw Error('The proposal has no changes');
  return proposal;
}
export const proposalTool = {
  type: 'namespace',
  name: 'school',
  description: 'School display admin: propose changes for human review; never publish.',
  tools: [
    {
      type: 'function',
      name: 'propose_changes',
      description:
        'Prepare supported changes to the selected screen draft. Only include fields the user requested.',
      strict: false,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['summary'],
        properties: {
          summary: {
            type: 'string',
            description: 'Explain the proposed change in the user language',
          },
          content: {
            type: 'object',
            additionalProperties: false,
            properties: Object.fromEntries(
              Object.entries(limits).map(([key, maxLength]) => [
                key,
                { type: 'string', maxLength },
              ]),
            ),
          },
          design: {
            type: 'object',
            additionalProperties: false,
            description:
              'Administrator-only appearance draft. Daily and loop modes, school names, colors, font size and photo/quote visibility.',
            properties: {
              displayMode: { type: 'string', enum: ['daily', 'loop'] },
              schoolName: { type: 'string', maxLength: 160 },
              loopSchoolName: { type: 'string', maxLength: 160 },
              background: { type: 'string', pattern: '^#[a-fA-F0-9]{6}$' },
              color: { type: 'string', pattern: '^#[a-fA-F0-9]{6}$' },
              accent: { type: 'string', pattern: '^#[a-fA-F0-9]{6}$' },
              fontSize: { type: 'number', minimum: 60, maximum: 180 },
              loopHidePhoto: { type: 'boolean' },
              showTechQuotes: { type: 'boolean' },
            },
          },
          schedule: {
            type: 'array',
            minItems: 1,
            maxItems: 7,
            description:
              'Weekly school broadcast (إذاعة) plan: one content entry per future date, NOT lesson times. Ask for the week/date if unknown.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['date', 'content'],
              properties: {
                date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
                content: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['title'],
                  properties: Object.fromEntries(
                    Object.entries(limits).map(([key, maxLength]) => [
                      key,
                      { type: 'string', maxLength },
                    ]),
                  ),
                },
              },
            },
          },
          periods: {
            type: 'array',
            minItems: 7,
            maxItems: 7,
            items: {
              type: 'array',
              minItems: 2,
              maxItems: 2,
              items: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
            },
          },
          refreshSeconds: { type: 'integer', enum: [30, 60, 120, 300] },
          clockTextScale: { type: 'number', minimum: 0.75, maximum: 2 },
          boardTextScale: { type: 'number', minimum: 0.75, maximum: 2 },
        },
      },
    },
  ],
};
export function assistantContext(screen, draft, admin) {
  const template = screen.template || {};
  return {
    screen: { id: screen.id, name: screen.name },
    content: contentPatch(draft?.content || {}),
    previewDate:
      typeof draft?.previewDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(draft.previewDate)
        ? draft.previewDate
        : undefined,
    canEditDesign: admin,
    design: Object.fromEntries(
      designKeys.map((key) => [key, draft?.design?.[key] ?? template[key]]),
    ),
    timetable: draft?.periods || template.timetable?.periods,
    refreshSeconds: draft?.refreshSeconds || template.recognition?.qudratPro?.refreshSeconds || 30,
    displayMode: draft?.displayMode || template.displayMode || 'daily',
    clockTextScale: draft?.clockTextScale || template.clockTextScale || 1,
    boardTextScale: draft?.boardTextScale || template.boardTextScale || 1,
    dateInRiyadh: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }),
    weekdayInRiyadh: new Date().toLocaleDateString('ar-SA', {
      timeZone: 'Asia/Riyadh',
      weekday: 'long',
    }),
  };
}
