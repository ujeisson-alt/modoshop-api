/**
 * Divide un script SQL en sentencias. Soporta bloques DELIMITER (stored procedures),
 * que los drivers de Node no entienden por sí solos.
 */
export const splitStatements = (sql: string): string[] => {
  const statements: string[] = [];
  let delimiter = ';';
  let buffer = '';
  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = /^DELIMITER\s+(\S+)/i.exec(trimmed);
    if (match) {
      delimiter = match[1];
      continue;
    }
    if (trimmed.startsWith('--') && buffer.trim() === '') continue;
    buffer += `${line}\n`;
    const code = trimmed.replace(/\s--\s.*$/, '').trim(); // ignora comentarios al final de la línea
    if (code.endsWith(delimiter)) {
      const statement = buffer.trim().slice(0, -delimiter.length).trim();
      if (statement) statements.push(statement);
      buffer = '';
    }
  }
  if (buffer.trim()) statements.push(buffer.trim());
  return statements;
};

/** Quita CREATE DATABASE / USE para ejecutar el script sobre la base ya seleccionada (p. ej. "railway"). */
export const stripDatabaseSelection = (statements: string[]): string[] =>
  statements.filter((s) => !/^(CREATE\s+DATABASE|USE)\s/i.test(s));
