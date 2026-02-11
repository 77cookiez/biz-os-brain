

# اعادة تنظيم قائمة Workboard — تقليل التبويبات وازالة التكرار

## المشاكل الحالية

1. **8 تبويبات** وهو عدد كبير يصعب التنقل (الممارسة العالمية: 5-7 كحد أقصى)
2. **تكرار واضح**: صفحة "قائمة الانتظار (Backlog)" وصفحة "مهام الفريق (Team Tasks)" تعرضان نفس البيانات من جدول `tasks` مع فلاتر متشابهة (backlog, blocked, planned مقابل all, backlog, in_progress, blocked, done)
3. **"اليوم" و"هذا الأسبوع" و"قائمة الانتظار"** كلها عروض مختلفة لنفس المهام مفلترة حسب الوقت
4. **"المراجعة الأسبوعية" و"العصف الذهني"** أدوات استراتيجية دورية وليست عروض يومية

## الحل المقترح — 5 تبويبات رئيسية

### الهيكل الجديد:

| التبويب | الأيقونة | المحتوى |
|---------|----------|---------|
| **المهام (Tasks)** | CheckSquare | يدمج: اليوم + هذا الأسبوع + قائمة الانتظار + مهام الفريق. عرض واحد بفلاتر داخلية ذكية |
| **الأهداف (Goals)** | Target | يبقى كما هو — الأهداف والخطط |
| **التقويم (Calendar)** | Calendar | يبقى كما هو — العرض الشهري |
| **المراجعة (Check-in)** | ClipboardCheck | يبقى كما هو — المراجعة الأسبوعية |
| **العصف الذهني (Brainstorm)** | Lightbulb | يبقى كما هو — الأفكار والاقتراحات |

### صفحة "المهام" الموحدة — التصميم الداخلي

الصفحة الموحدة ستحتوي على **3 طبقات تصفية**:

**أ. شريط العرض (View Switcher):**
- **اليوم** — الأولويات والمتأخرات ومهام اليوم (نفس المنطق الحالي)
- **الأسبوع** — مجموعة حسب الأيام (نفس المنطق الحالي)
- **الكل** — جميع المهام مع فلاتر الحالة (backlog/planned/in_progress/blocked/done)

**ب. فلتر "إسناد إلى" (Assignment Filter):**
- الكل / مهامي / مهام أعضاء الفريق (يظهر فقط إذا كان هناك فريق)

**ج. شارة مصدر التعيين:**
- تبقى كما هي (AI / المدير)

هذا يحل مشكلة التكرار لأن:
- "قائمة الانتظار" تصبح عرض "الكل" مع فلتر الحالة = backlog
- "مهام الفريق" تصبح عرض "الكل" مع فلتر الإسناد = أعضاء الفريق

## التغييرات التقنية المطلوبة

### 1. WorkboardLayout.tsx — تقليص التبويبات من 8 الى 5

```
التبويبات الجديدة:
/apps/workboard          -> صفحة المهام الموحدة (Tasks)
/apps/workboard/goals    -> الأهداف (Goals)
/apps/workboard/calendar -> التقويم (Calendar)
/apps/workboard/checkin  -> المراجعة (Check-in)
/apps/workboard/brainstorm -> العصف الذهني (Brainstorm)
```

حذف المسارات القديمة: `/apps/workboard/week`, `/apps/workboard/backlog`, `/apps/workboard/tasks`

### 2. صفحة UnifiedTasksPage.tsx — صفحة جديدة تدمج 4 صفحات

- تحتوي على **View Switcher** (اليوم / الأسبوع / الكل) كأزرار صغيرة في الأعلى
- تحتوي على **Assignment Filter** (الكل / مهامي / الفريق) في الأعلى أيضا
- عرض "اليوم": نفس منطق `WorkboardTodayPage` (الأولويات + المتأخرات + مهام اليوم)
- عرض "الأسبوع": نفس منطق `WorkboardWeekPage` (أيام الأسبوع)
- عرض "الكل": نفس منطق `TeamTasksPage` (فلاتر الحالة + إنشاء مهمة + إسناد ذكي + شارات المصدر)
- زر إنشاء مهمة متاح في كل العروض مع دعم الإسناد الذكي

### 3. App.tsx — تحديث المسارات

- حذف المسارات القديمة (`week`, `backlog`, `tasks`)
- اضافة redirect من المسارات القديمة الى `/apps/workboard` لمنع الروابط المكسورة

### 4. ملفات الترجمة (5 لغات)

مفاتيح جديدة:
```
workboard.tabs.tasks = "المهام" (بدل today)
workboard.views.today = "اليوم"
workboard.views.week = "الأسبوع"
workboard.views.all = "الكل"
workboard.filters.all = "الكل"
workboard.filters.myTasks = "مهامي"
workboard.filters.teamTasks = "مهام الفريق"
```

### 5. حذف الصفحات القديمة

- `WorkboardTodayPage.tsx` — يتم دمج منطقها في الصفحة الموحدة
- `WorkboardWeekPage.tsx` — يتم دمج منطقها في الصفحة الموحدة
- `WorkboardBacklogPage.tsx` — يتم دمج منطقها في الصفحة الموحدة
- `TeamTasksPage.tsx` — يتم دمج منطق الإسناد والفلترة في الصفحة الموحدة

### الملفات المتأثرة

1. `src/pages/workboard/WorkboardLayout.tsx` — تقليص التبويبات
2. `src/pages/workboard/UnifiedTasksPage.tsx` — صفحة جديدة موحدة
3. `src/App.tsx` — تحديث المسارات
4. `src/i18n/translations/{en,ar,fr,es,de}.json` — مفاتيح جديدة
5. حذف: `WorkboardTodayPage.tsx`, `WorkboardWeekPage.tsx`, `WorkboardBacklogPage.tsx`
6. نقل منطق `TeamTasksPage.tsx` (الإسناد الذكي + دعوة الفريق) الى الصفحة الموحدة

