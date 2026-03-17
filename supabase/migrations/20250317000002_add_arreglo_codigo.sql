-- Add codigo field to arreglos (custom code shown after photo, e.g. AR-001, Ramo-01)
ALTER TABLE arreglos ADD COLUMN IF NOT EXISTS codigo TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_arreglos_codigo ON arreglos(codigo) WHERE codigo IS NOT NULL;
