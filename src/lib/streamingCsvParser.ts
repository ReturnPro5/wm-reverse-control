// Streaming CSV parser for very large files (200MB+)
// Processes file in chunks to avoid memory exhaustion

export interface StreamingParseOptions {
  onProgress?: (percent: number, rowsProcessed: number) => void;
  onBatch?: (rows: Record<string, string>[], batchIndex: number) => Promise<void>;
  batchSize?: number;
}

export async function* streamCSVRows(
  content: string,
  options?: { onProgress?: (percent: number) => void }
): AsyncGenerator<Record<string, string>> {
  const lines = content.split('\n');
  const totalLines = lines.length;
  
  if (totalLines === 0) return;
  
  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  for (let i = 1; i < totalLines; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    
    yield row;
    
    // Report progress every 1000 rows
    if (i % 1000 === 0 && options?.onProgress) {
      options.onProgress((i / totalLines) * 100);
      // Yield to browser
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Chunk-based parser that processes batches and yields control
export async function parseCSVInChunks(
  content: string,
  options: StreamingParseOptions
): Promise<{ totalRows: number; headers: string[] }> {
  const batchSize = options.batchSize || 500;
  const lines = content.split('\n');
  const totalLines = lines.length;
  
  if (totalLines === 0) {
    return { totalRows: 0, headers: [] };
  }
  
  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  let batch: Record<string, string>[] = [];
  let batchIndex = 0;
  let rowsProcessed = 0;
  
  for (let i = 1; i < totalLines; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    
    batch.push(row);
    rowsProcessed++;
    
    // When batch is full, process it
    if (batch.length >= batchSize) {
      if (options.onBatch) {
        await options.onBatch(batch, batchIndex);
      }
      
      if (options.onProgress) {
        options.onProgress((i / totalLines) * 100, rowsProcessed);
      }
      
      batch = [];
      batchIndex++;
      
      // Yield to browser to prevent freezing
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  // Process remaining rows
  if (batch.length > 0 && options.onBatch) {
    await options.onBatch(batch, batchIndex);
  }
  
  return { totalRows: rowsProcessed, headers };
}
