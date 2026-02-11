

# تحسين Team Tasks — إسناد المهام الذكي مع تتبع مصدر التعيين

## الفكرة

حاليا يمكن إسناد مهمة لشخص يدويا عبر قائمة منسدلة، لكن لا يوجد تتبع لمن أسند المهمة ولا اقتراح ذكي. التحسين يضيف:

1. **عمودين جديدين** في جدول `tasks`: من أسند المهمة (`assigned_by`) وكيف تم الإسناد (`assignment_source`: ai / manager / self)
2. **زر "اقتراح ذكي"** يستخدم Brain لاقتراح الشخص الأنسب بناء على دوره ومهامه الحالية
3. **شارة بصرية** على كل مهمة توضح مصدر التعيين (AI اقترح / المدير عيّن)
4. **ترجمة كاملة** لصفحة Team Tasks (حاليا نصوص إنجليزية ثابتة)

## التغييرات المطلوبة

### 1. Migration — إضافة أعمدة تتبع الإسناد

```sql
ALTER TABLE public.tasks
  ADD COLUMN assigned_by uuid,
  ADD COLUMN assignment_source text DEFAULT 'manager';
-- القيم المقبولة: 'ai', 'manager', 'self'
```

### 2. brain-chat Edge Function — إضافة action جديد `suggest_assignee`

- يستقبل: عنوان المهمة + وصفها + قائمة أعضاء الفريق (الاسم + الدور + عدد مهامهم الحالية)
- يرجع: `user_id` العضو المقترح + سبب مختصر
- القواعد: يراعي توزيع الحمل + تطابق الدور + المهام المحظورة

### 3. TeamTasksPage.tsx — تحسينات شاملة

**أ. ترجمة كاملة (i18n):**
- استبدال جميع النصوص الثابتة بمفاتيح ترجمة (`t('teamTasks.title')`, `t('teamTasks.addTask')`, etc.)

**ب. إسناد ذكي عند إنشاء مهمة:**
- إضافة زر Sparkles بجوار قائمة "Assign to"
- عند النقر: يرسل سياق المهمة + بيانات الفريق لـ `brain-chat` مع action `suggest_assignee`
- يملأ القائمة تلقائيا بالعضو المقترح
- يحفظ `assignment_source = 'ai'` و `assigned_by = user.id`

**ج. شارة مصدر التعيين:**
- بجوار اسم العضو المسند إليه:
  - شارة "AI" (بلون بنفسجي) إذا كان `assignment_source = 'ai'`
  - شارة "Manager" (بلون أزرق) إذا كان `assignment_source = 'manager'`

### 4. ملفات الترجمة (5 لغات)

مفاتيح جديدة تحت `teamTasks`:

```text
teamTasks.title = "مهام الفريق"
teamTasks.addTask = "إضافة مهمة"
teamTasks.assignTo = "إسناد إلى"
teamTasks.unassigned = "غير مسند"
teamTasks.suggestAssignee = "اقتراح ذكي"
teamTasks.assignedByAi = "اقتراح AI"
teamTasks.assignedByManager = "تعيين المدير"
teamTasks.inviteTeamMember = "دعوة عضو"
teamTasks.createTask = "إنشاء مهمة"
teamTasks.noTasks = "لا توجد مهام"
teamTasks.soloMode = "وضع فردي"
teamTasks.teamMembers = "{{count}} أعضاء فريق"
teamTasks.taskTitle = "عنوان المهمة"
teamTasks.description = "الوصف (اختياري)"
teamTasks.definitionOfDone = "تعريف الإنجاز (اختياري)"
teamTasks.inviteViaWhatsApp = "دعوة عبر واتساب"
teamTasks.sendInvitation = "إرسال الدعوة"
teamTasks.emailAddress = "البريد الإلكتروني"
```

## التفاصيل التقنية

### Prompt اقتراح الشخص المناسب

```text
You are a team task assignment advisor. Based on the task details and team data,
suggest the best team member to assign this task to.

TASK:
- Title: {title}
- Description: {description}

TEAM MEMBERS:
{members.map(m => `- ${m.name} (Role: ${m.role}, Active tasks: ${m.taskCount}, Blocked: ${m.blockedCount})`)}

Rules:
- Return ONLY a JSON object: {"user_id": "...", "reason": "..."}
- Consider role match, current workload balance, and blocked tasks
- Reason must be 1 sentence max
- No markdown, no code blocks
```

### تدفق الإسناد الذكي

```text
User clicks "Suggest" button
  -> Gather: task title + description + team members + their task counts
  -> Call brain-chat with action "suggest_assignee"
  -> Parse JSON response
  -> Auto-select member in dropdown
  -> Set assignment_source = "ai"
  -> Show purple "AI" badge

User manually selects member
  -> Set assignment_source = "manager"
  -> Show blue "Manager" badge
```

### الملفات المتأثرة

1. `supabase/migrations/` — عمودين جديدين `assigned_by` و `assignment_source`
2. `supabase/functions/brain-chat/index.ts` — action جديد `suggest_assignee`
3. `src/pages/brain/TeamTasksPage.tsx` — ترجمة كاملة + زر اقتراح ذكي + شارات المصدر
4. `src/i18n/translations/{en,ar,fr,es,de}.json` — مفاتيح جديدة تحت `teamTasks`
