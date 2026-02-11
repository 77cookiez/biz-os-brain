

# تحسين خطوة الأولويات — زر "اقتراح ذكي" يملأ الحقول اليدوية

## الفكرة

حاليا الأولويات اليدوية (3 حقول نصية) فارغة دائما وتنتظر الكتابة. التحسين يضيف زر **"اقترح أولويات"** بجانب العنوان، يستدعي Brain مع سياق غني (OIL indicators + المهام المتأخرة/المحظورة + الأهداف + company_memory) ليملأ الحقول الثلاثة تلقائيا. المستخدم يعدّل أو يمسح أي حقل كما يشاء.

## التغييرات المطلوبة

### 1. StepPriorities.tsx — إضافة زر اقتراح للحقول اليدوية

- إضافة زر Sparkles بجانب عنوان "أولوياتك" يستدعي `onSuggestManual`
- عرض حالة تحميل أثناء الانتظار
- الحقول تبقى قابلة للتعديل بالكامل بعد الملء

### 2. WeeklyCheckinPage.tsx — منطق الاقتراح الذكي

- إنشاء دالة `handleSuggestManualPriorities` تجمع السياق:
  - مؤشرات OIL (scores + trends)
  - المهام المتأخرة والمحظورة (من `taskStats` الموجود)
  - الأهداف المتأخرة (من `goalReviews`)
  - الإنجازات (من `completedItems`)
  - القرارات المتخذة في خطوة IDS (من `issues`)
- إرسال prompt غني لـ `brain-chat` بـ action `weekly_checkin_priorities`
- تحليل الرد وملء `manualPriorities` بالنتائج

### 3. brain-chat Edge Function — تحسين prompt الأولويات

- تحديث prompt الـ `weekly_checkin_priorities` ليشمل بيانات OIL والسياق الكامل
- التأكيد على إرجاع 3 أولويات فقط، كل واحدة في سطر مرقم، بدون شرح

### 4. ملفات الترجمة (5 لغات)

- إضافة مفتاح `suggestManualPriorities` (مثل "اقترح لي أولويات")

## التفاصيل التقنية

### Prompt المحسّن

```text
You are a business strategy advisor. Based on the following workspace data, 
suggest exactly 3 priorities for next week.

OIL INDICATORS:
- ExecutionHealth: {score}/100 (trend: {trend})
- DeliveryRisk: {score}/100 (trend: {trend})
- GoalProgress: {score}/100 (trend: {trend})

THIS WEEK:
- Completed: {count} tasks
- Overdue: {count} tasks
- Blocked: {count} tasks
- Off-track goals: [list]
- IDS decisions taken: [list]

Rules:
- Return ONLY 3 numbered lines (1. 2. 3.)
- Each line is a specific, actionable task title
- No explanations, no bullets, no markdown
- Respond in the user's language
```

### تعديل Props في StepPriorities

```text
// إضافة:
+ onSuggestManual: () => void;
+ manualSuggestionsLoading: boolean;
```

### الملفات المتأثرة

1. `src/components/checkin/StepPriorities.tsx` — زر اقتراح + حالة تحميل
2. `src/pages/brain/WeeklyCheckinPage.tsx` — منطق جمع السياق وملء الحقول
3. `supabase/functions/brain-chat/index.ts` — تحسين prompt الأولويات
4. `src/i18n/translations/{en,ar,fr,es,de}.json` — مفتاح جديد

