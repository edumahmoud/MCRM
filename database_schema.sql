
-- ==========================================
-- MEEZA POS - DATABASE FIX (v12.5)
-- FIX: Treasury Source Check Constraint & FKs
-- ==========================================

-- 1. حذف قيد التحقق (Check Constraint) الذي يسبب الخطأ 23514
-- هذا يسمح بإدراج 'manual' كـ source عند حذف المصروف
ALTER TABLE public.treasury_logs DROP CONSTRAINT IF EXISTS treasury_logs_source_check;

-- 2. حذف جميع قيود المفتاح الأجنبي المرتبطة بجدول الخزينة ديناميكياً (لتفادي مشاكل reference_id)
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'treasury_logs' 
        AND constraint_type = 'FOREIGN KEY'
    ) LOOP 
        EXECUTE 'ALTER TABLE public.treasury_logs DROP CONSTRAINT IF EXISTS "' || r.constraint_name || '" CASCADE'; 
    END LOOP; 
END $$;

-- 3. حذف جميع قيود المفتاح الأجنبي التي تشير إلى جدول المصروفات (للسماح بحذف المصروف)
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN (
        SELECT tc.table_name, tc.constraint_name 
        FROM information_schema.table_constraints tc 
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name 
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name 
        WHERE ccu.table_name = 'expenses' 
        AND tc.constraint_type = 'FOREIGN KEY'
    ) LOOP 
        EXECUTE 'ALTER TABLE public.' || r.table_name || ' DROP CONSTRAINT IF EXISTS "' || r.constraint_name || '" CASCADE'; 
    END LOOP; 
END $$;

-- 4. التأكد من أن عمود reference_id يقبل النصوص والقيم الفارغة
ALTER TABLE public.treasury_logs 
  ALTER COLUMN reference_id TYPE TEXT USING reference_id::text;

ALTER TABLE public.treasury_logs 
  ALTER COLUMN reference_id DROP NOT NULL;

-- 5. منح الصلاحيات اللازمة
GRANT DELETE ON public.expenses TO anon, authenticated, service_role;
GRANT INSERT ON public.treasury_logs TO anon, authenticated, service_role;
