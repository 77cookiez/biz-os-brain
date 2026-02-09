

# خطة التنفيذ: إدارة التطبيقات في الإعدادات + نقل الشاشات إلى Workboard

## ملخص التغييرات

تغييران رئيسيان:
1. إضافة صفحة "Apps" ضمن الإعدادات لإدارة التطبيقات المثبتة (تفعيل/إلغاء تفعيل)
2. نقل Goals & Plans و Team Tasks و Weekly Check-in من Business Brain إلى Workboard بالكامل

---

## 1. صفحة إدارة التطبيقات (Settings > Apps)

- إنشاء صفحة جديدة `src/pages/settings/AppsSettingsPage.tsx`
- تعرض جميع التطبيقات المثبتة في الـ workspace الحالي
- لكل تطبيق: اسمه، حالته (مفعل/معطل)، وزر Activate/Deactivate
- رابط سريع للذهاب إلى Marketplace لاكتشاف تطبيقات جديدة
- إضافة الصفحة إلى قائمة Settings وإلى الـ Router

## 2. نقل الشاشات من Brain إلى Workboard

### ما سيتغير في Business Brain (Sidebar):
- إزالة "Goals & Plans" و "Team Tasks" و "Weekly Check-in" من قائمة Brain
- يبقى فقط: **Today** (الصفحة الرئيسية للتفكير والتخطيط)

### ما سيتغير في Workboard:
- إضافة تبويبين جديدين في Workboard Layout:
  - **Team Tasks** - نفس الصفحة الحالية مع نقلها
  - **Check-in** - Weekly Check-in
- الترتيب النهائي للتبويبات: Today, This Week, Backlog, Goals, Team Tasks, Calendar, Check-in, Brainstorm

### تحديث الـ Routing:
- إزالة routes: `/brain/goals`, `/brain/tasks`, `/brain/checkin`
- إضافة routes جديدة تحت Workboard:
  - `/apps/workboard/tasks` (Team Tasks)
  - `/apps/workboard/checkin` (Weekly Check-in)
- Goals موجودة بالفعل في `/apps/workboard/goals`

---

## التفاصيل التقنية

### الملفات الجديدة:
- `src/pages/settings/AppsSettingsPage.tsx` - صفحة إدارة التطبيقات

### الملفات المعدلة:
- `src/pages/SettingsPage.tsx` - إضافة رابط "Apps" في قائمة الإعدادات
- `src/App.tsx` - تحديث Routes (إزالة brain routes القديمة، إضافة workboard routes جديدة، إضافة settings/apps route)
- `src/components/AppSidebar.tsx` - إزالة روابط Goals/Tasks/Check-in من قسم Brain
- `src/pages/workboard/WorkboardLayout.tsx` - إضافة تبويبات Team Tasks و Check-in
- `src/pages/brain/TeamTasksPage.tsx` - تعديل بسيط ليعمل ضمن Workboard
- `src/pages/brain/WeeklyCheckinPage.tsx` - تعديل بسيط ليعمل ضمن Workboard

### ملاحظات:
- صفحة GoalsPage الموجودة في Brain ستُزال من الـ routing لأن Workboard لديه بالفعل صفحة Goals خاصة به
- البيانات في قاعدة البيانات (tasks, goals, weekly_checkins) لن تتأثر - فقط الواجهة تتغير
- لا حاجة لتغييرات في قاعدة البيانات

