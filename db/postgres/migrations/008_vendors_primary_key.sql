-- AdminJS @adminjs/sql requires a PRIMARY KEY on each managed table.
-- Child table vendors() INHERITS (users) does not inherit the parents PK constraint in PostgreSQL.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendors')
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.vendors'::regclass AND contype = 'p'
     ) THEN
    ALTER TABLE public.vendors ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);
  END IF;
END $$;
