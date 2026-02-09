
# تطبيق مبدأ "Business Brain = يفكر فقط، لا ينفذ"

## الوضع الحالي والمشاكل

حاليًا، Business Brain يخالف المبدأ في عدة مواضع:

1. **صفحة Today** تحتوي على زر "Add Task" الذي يُنشئ مهام مباشرة — هذا تنفيذ وليس تفكير
2. **BrainCommandBar** عند الضغط على "Confirm" يُنشئ مهام مباشرة في Workboard — يجب أن يكون مسودة (Draft) فقط
3. **System Prompt في brain-chat** يصف Brain كأنه يملك صلاحيات تنفيذية (Task management, Weekly check-ins)

## التغييرات المطلوبة

### 1. صفحة Today — إزالة التنفيذ المباشر
**ملف:** `src/pages/brain/TodayPage.tsx`
- إزالة زر "Add Task" والـ `AddTaskDialog` بالكامل
- الإبقاء على العرض القراءي (Priority Tasks, Overdue, This Week) لأنه read-only
- الإبقاء على Quick Actions لأنها تملأ الـ Command Bar فقط (لا تنفذ)
- تغيير زر "Ask Brain to Plan" ليبقى كما هو (يملأ Command Bar)

### 2. BrainCommandBar — مسودات فقط بدون تنفيذ مباشر
**ملف:** `src/components/brain/BrainCommandBar.tsx`
- زر "Confirm" يتحول إلى "Send to Workboard as Draft"
- عند الضغط، المهام تُنشأ بحالة `backlog` (مسودة) بدلاً من `planned`
- إضافة تنبيه واضح أن المهام أُرسلت كمسودات تحتاج مراجعة في Workboard

### 3. System Prompt — تحديث دور Brain
**ملف:** `supabase/functions/brain-chat/index.ts`
- تحديث الوصف ليعكس الدور الجديد: "تحلل، تنصح، تقترح مسودات"
- إزالة "Task management" من القدرات
- إضافة توضيح أن Brain يقرأ بيانات Workboard لكن لا يملكها
- التأكيد على أن كل اقتراح هو مسودة تحتاج موافقة المستخدم
- إزالة `weekly_checkin` action لأن Check-in انتقل إلى Workboard

### 4. TodayPage — إضافة تحليل ذكي (Read-Only Insights)
**ملف:** `src/pages/brain/TodayPage.tsx`
- إضافة قسم "Insights" يعرض ملاحظات تحليلية بناءً على بيانات Workboard:
  - عدد المهام المتأخرة مع تحذير
  - عدد المهام المحظورة (blocked)
  - نسبة الإنجاز هذا الأسبوع
- هذه بيانات قراءة فقط، لا أزرار تنفيذ

---

## التفاصيل التقنية

### الملفات المعدلة:
| الملف | التغيير |
|-------|---------|
| `src/pages/brain/TodayPage.tsx` | إزالة Add Task، إضافة Insights قراءية |
| `src/components/brain/BrainCommandBar.tsx` | تغيير Confirm إلى "Send as Draft"، حالة backlog |
| `supabase/functions/brain-chat/index.ts` | تحديث System Prompt ليعكس الدور الاستشاري |

### لا حاجة لتغييرات في قاعدة البيانات
- البيانات نفسها، فقط طريقة التعامل معها تتغير
