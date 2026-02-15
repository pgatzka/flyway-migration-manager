/** Metadata about a PostgreSQL data type */
export interface PgType {
  name: string;
  /** Does this type accept a length parameter? e.g. VARCHAR(255) */
  hasLength: boolean;
  /** Does this type accept precision/scale? e.g. NUMERIC(10,2) */
  hasPrecision: boolean;
}

export interface PgTypeCategory {
  label: string;
  types: PgType[];
}

const t = (name: string, hasLength = false, hasPrecision = false): PgType => ({
  name,
  hasLength,
  hasPrecision,
});

export const PG_TYPE_CATEGORIES: PgTypeCategory[] = [
  {
    label: 'Numeric',
    types: [
      t('SMALLINT'),
      t('INTEGER'),
      t('BIGINT'),
      t('SERIAL'),
      t('BIGSERIAL'),
      t('NUMERIC', false, true),
      t('DECIMAL', false, true),
      t('REAL'),
      t('DOUBLE PRECISION'),
    ],
  },
  {
    label: 'Text',
    types: [
      t('TEXT'),
      t('VARCHAR', true),
      t('CHAR', true),
      t('CITEXT'),
    ],
  },
  {
    label: 'Boolean',
    types: [t('BOOLEAN')],
  },
  {
    label: 'Date/Time',
    types: [
      t('TIMESTAMP'),
      t('TIMESTAMP WITH TIME ZONE'),
      t('DATE'),
      t('TIME'),
      t('TIME WITH TIME ZONE'),
      t('INTERVAL'),
    ],
  },
  {
    label: 'JSON',
    types: [t('JSON'), t('JSONB')],
  },
  {
    label: 'UUID',
    types: [t('UUID')],
  },
  {
    label: 'Binary',
    types: [t('BYTEA')],
  },
  {
    label: 'Network',
    types: [t('INET'), t('CIDR'), t('MACADDR')],
  },
  {
    label: 'Other',
    types: [
      t('OID'),
      t('MONEY'),
      t('TSVECTOR'),
      t('TSQUERY'),
      t('XML'),
      t('POINT'),
      t('LINE'),
      t('POLYGON'),
      t('BOX'),
      t('CIRCLE'),
    ],
  },
];

/** Flat list of all PG type names */
export const ALL_PG_TYPES: PgType[] = PG_TYPE_CATEGORIES.flatMap((c) => c.types);

/** Look up a PG type by name (case-insensitive) */
export function findPgType(name: string): PgType | undefined {
  return ALL_PG_TYPES.find((t) => t.name.toLowerCase() === name.toLowerCase());
}
