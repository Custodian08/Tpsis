import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Client } from './entities/client.entity';
import { Transaction } from './entities/transaction.entity';
import * as csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

const MAX_IMPORT_ROWS = 50_000;
const MAX_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_VALIDATION_ERRORS = 100;

interface ImportClientData {
  clientExternalId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  clientType: string;
}

interface ImportTransactionData {
  clientExternalId: string;
  transactionDate: Date;
  amount: number;
  itemsCount: number;
  paymentMethod: string | null;
}

@Injectable()
export class DataService {
  constructor(private readonly dataSource: DataSource) {}

  async importFromCSV(file: Express.Multer.File, userId: number) {
    this.validateFile(file, ['.csv']);
    const results = await this.parseCSV(file);
    return this.processImportData(results, userId);
  }

  async previewFromCSV(file: Express.Multer.File, userId: number) {
    this.validateFile(file, ['.csv']);
    const results = await this.parseCSV(file);
    return this.processImportData(results, userId, false);
  }

  private parseCSV(file: Express.Multer.File): Promise<Record<string, unknown>[]> {
    const results: Record<string, unknown>[] = [];
    const text = this.decodeCsv(file.buffer);
    const readableStream = Readable.from([text]);
    const parser = csv({
      separator: this.detectCsvSeparator(text),
      mapHeaders: ({ header }) => header?.replace(/^\uFEFF/, '').trim(),
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      readableStream
        .pipe(parser)
        .on('data', (data) => {
          if (settled) return;
          results.push(data);
          if (results.length > MAX_IMPORT_ROWS) {
            settled = true;
            parser.destroy();
            reject(new BadRequestException(`Файл превышает лимит в ${MAX_IMPORT_ROWS} строк`));
          }
        })
        .on('end', () => {
          if (settled) return;
          resolve(results);
        })
        .on('error', () => {
          if (!settled) {
            reject(new BadRequestException('Не удалось прочитать CSV. Проверьте кодировку и структуру файла.'));
          }
        });
    });
  }

  private decodeCsv(buffer: Buffer): string {
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
      return new TextDecoder('utf-16le').decode(buffer.subarray(2));
    }
    if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
      return new TextDecoder('utf-16be').decode(buffer.subarray(2));
    }
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return new TextDecoder('utf-8').decode(buffer);
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      // Windows Excel commonly exports Cyrillic CSV as Windows-1251 without a BOM.
      return new TextDecoder('windows-1251').decode(buffer);
    }
  }

  private detectCsvSeparator(text: string): string {
    const firstLine = text.split(/\r?\n/, 1)[0] || '';
    const counts = new Map([[',', 0], [';', 0], ['\t', 0]]);
    let quoted = false;
    for (let index = 0; index < firstLine.length; index += 1) {
      const character = firstLine[index];
      if (character === '"') {
        if (quoted && firstLine[index + 1] === '"') index += 1;
        else quoted = !quoted;
      } else if (!quoted && counts.has(character)) {
        counts.set(character, counts.get(character)! + 1);
      }
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
  }

  async importFromExcel(file: Express.Multer.File, userId: number) {
    this.validateFile(file, ['.xlsx', '.xls']);
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new BadRequestException('В книге Excel нет листа с данными');
      }

      const worksheet = workbook.Sheets[sheetName];
      const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
      if (range && range.e.r > MAX_IMPORT_ROWS) {
        throw new BadRequestException(`Файл превышает лимит в ${MAX_IMPORT_ROWS} строк`);
      }
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: '',
      });
      return await this.processImportData(jsonData, userId);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Не удалось прочитать Excel. Проверьте формат и структуру файла.');
    }
  }

  async previewFromExcel(file: Express.Multer.File, userId: number) {
    this.validateFile(file, ['.xlsx', '.xls']);
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new BadRequestException('В книге Excel нет листа с данными');
      }

      const worksheet = workbook.Sheets[sheetName];
      const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
      if (range && range.e.r > MAX_IMPORT_ROWS) {
        throw new BadRequestException(`Файл превышает лимит в ${MAX_IMPORT_ROWS} строк`);
      }
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
      return await this.processImportData(jsonData, userId, false);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Не удалось прочитать Excel. Проверьте формат и структуру файла.');
    }
  }

  private validateFile(file: Express.Multer.File, allowedExtensions: string[]) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Файл пуст или не загружен');
    }
    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      throw new BadRequestException('Размер файла не должен превышать 10 МБ');
    }

    const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      throw new BadRequestException(`Ожидается файл формата ${allowedExtensions.join(' или ')}`);
    }
  }

  private async processImportData(
    data: Record<string, unknown>[],
    userId: number,
    persist = true,
  ) {
    if (data.length === 0) {
      throw new BadRequestException('Файл не содержит строк с данными');
    }
    if (data.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`Файл превышает лимит в ${MAX_IMPORT_ROWS} строк`);
    }
    this.validateHeaders(Object.keys(data[0]));

    const clientsByExternalId = new Map<string, ImportClientData>();
    const transactions: ImportTransactionData[] = [];
    const validationErrors: string[] = [];
    let validationErrorCount = 0;

    data.forEach((row, index) => {
      const rowNumber = index + 2;
      const clientIdValue = this.firstValue(row, ['client_id', 'clientId', 'id']);
      const clientExternalId = clientIdValue == null ? '' : String(clientIdValue).trim();
      const dateValue = this.firstValue(row, ['transaction_date', 'transactionDate', 'date']);
      const amountValue = this.firstValue(row, ['amount', 'sum']);
      const transactionDate = this.parseDate(dateValue);
      const amount = this.parseAmount(amountValue);
      const itemsCountValue = this.firstValue(row, ['items_count', 'itemsCount']);
      const itemsCount =
        itemsCountValue == null || itemsCountValue === '' ? 1 : Number(itemsCountValue);

      const rowErrors: string[] = [];
      if (!clientExternalId) rowErrors.push('не указан client_id');
      if (!transactionDate) rowErrors.push('некорректная дата покупки');
      if (amount === null) {
        rowErrors.push(
          'сумма должна быть в допустимом диапазоне и содержать не более двух знаков после запятой',
        );
      }
      if (!Number.isInteger(itemsCount) || itemsCount < 1) {
        rowErrors.push('items_count должен быть целым числом не меньше 1');
      }

      if (rowErrors.length) {
        validationErrorCount += 1;
        if (validationErrors.length < MAX_VALIDATION_ERRORS) {
          validationErrors.push(`Строка ${rowNumber}: ${rowErrors.join(', ')}`);
        }
        return;
      }

      if (!clientExternalId || !transactionDate || amount === null) return;

      if (!clientsByExternalId.has(clientExternalId)) {
        clientsByExternalId.set(clientExternalId, {
          clientExternalId,
          fullName: this.optionalString(this.firstValue(row, ['full_name', 'fullName', 'name'])),
          email: this.optionalString(this.firstValue(row, ['email'])),
          phone: this.optionalString(this.firstValue(row, ['phone'])),
          clientType:
            this.optionalString(this.firstValue(row, ['client_type', 'clientType'])) || 'individual',
        });
      }

      transactions.push({
        clientExternalId,
        transactionDate,
        amount,
        itemsCount,
        paymentMethod: this.optionalString(this.firstValue(row, ['payment_method', 'paymentMethod'])),
      });
    });

    if (validationErrorCount) {
      const omittedCount = validationErrorCount - validationErrors.length;
      const suffix = omittedCount ? ` Показаны первые ${MAX_VALIDATION_ERRORS} ошибки.` : '';
      throw new BadRequestException({
        message: `Импорт отменён: исправьте некорректные строки.${suffix}`,
        errors: validationErrors,
      });
    }

    if (!persist) {
      const dates = transactions.map(row => row.transactionDate.toISOString().slice(0, 10)).sort();
      return {
        clientsInFile: clientsByExternalId.size,
        transactionsInFile: transactions.length,
        dateFrom: dates[0],
        dateTo: dates[dates.length - 1],
        sampleRows: transactions.slice(0, 10).map(row => ({
          clientExternalId: row.clientExternalId,
          fullName: clientsByExternalId.get(row.clientExternalId)?.fullName || '',
          transactionDate: row.transactionDate.toISOString().slice(0, 10),
          amount: row.amount,
          itemsCount: row.itemsCount,
        })),
      };
    }

    return this.dataSource.transaction(async (manager) => {
      const clientsRepository = manager.getRepository(Client);
      const transactionsRepository = manager.getRepository(Transaction);
      const externalIds = [...clientsByExternalId.keys()];
      const existingClients = externalIds.length
        ? await clientsRepository.find({
            where: { ownerUserId: userId, clientExternalId: In(externalIds) },
          })
        : [];
      const clientIdMap = new Map(existingClients.map(client => [client.clientExternalId, client.id]));
      const newClientData = externalIds
        .filter(externalId => !clientIdMap.has(externalId))
        .map(externalId => clientsByExternalId.get(externalId)!);

      const savedClients = newClientData.length
        ? await clientsRepository.save(
          newClientData.map(client => clientsRepository.create({ ...client, ownerUserId: userId })),
            { chunk: 500 },
          )
        : [];
      savedClients.forEach(client => clientIdMap.set(client.clientExternalId, client.id));

      const transactionEntities = transactions.map(transaction =>
        transactionsRepository.create({
          clientId: clientIdMap.get(transaction.clientExternalId)!,
          transactionDate: transaction.transactionDate,
          amount: transaction.amount,
          itemsCount: transaction.itemsCount,
          paymentMethod: transaction.paymentMethod,
        }),
      );
      await transactionsRepository.save(transactionEntities, { chunk: 500 });

      return {
        clientsImported: savedClients.length,
        transactionsImported: transactionEntities.length,
        errors: 0,
      };
    });
  }

  private firstValue(row: Record<string, unknown>, names: string[]) {
    const aliases = new Set(names.map(name => name.toLowerCase()));
    const matchingKey = Object.keys(row).find(key => aliases.has(key.trim().toLowerCase()));
    if (matchingKey !== undefined) {
      const value = row[matchingKey];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    for (const name of names) {
      const value = row[name];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
  }

  private validateHeaders(headers: string[]) {
    const normalizedHeaders = new Set(headers.map(header => header.trim().toLowerCase()));
    const requiredColumns = [
      { names: ['client_id', 'clientId', 'id'], label: 'идентификатор клиента' },
      { names: ['transaction_date', 'transactionDate', 'date'], label: 'дата покупки' },
      { names: ['amount', 'sum'], label: 'сумма покупки' },
    ];
    const missingColumns = requiredColumns
      .filter(column => !column.names.some(name => normalizedHeaders.has(name.toLowerCase())))
      .map(column => column.label);

    if (missingColumns.length) {
      throw new BadRequestException(
        `В файле отсутствуют обязательные столбцы: ${missingColumns.join(', ')}.`,
      );
    }
  }

  private optionalString(value: unknown): string | null {
    if (value === undefined || value === null || value === '') return null;
    return String(value).trim() || null;
  }

  private parseAmount(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'string' && !/^[+-]?\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
    const amount = Number(value);
    const hasAtMostTwoDecimals = Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-8;
    return Number.isFinite(amount) &&
      hasAtMostTwoDecimals &&
      Math.abs(amount) <= 99_999_999.99
      ? amount
      : null;
  }

  private parseDate(value: unknown): Date | null {
    if (value === undefined || value === null || value === '') return null;

    let date: Date;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      const parts = XLSX.SSF.parse_date_code(value);
      if (!parts) return null;
      date = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
    } else {
      const text = String(value).trim();
      const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
      if (isoDate) {
        const [, year, month, day] = isoDate;
        date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
        if (
          date.getUTCFullYear() !== Number(year) ||
          date.getUTCMonth() !== Number(month) - 1 ||
          date.getUTCDate() !== Number(day)
        ) {
          return null;
        }
      } else {
        date = new Date(text);
      }
    }

    return Number.isNaN(date.getTime()) ? null : date;
  }

  async getClients(query: { page?: number; pageSize?: number; search?: string }, userId: number) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 25;
    const qb = this.dataSource.getRepository(Client).createQueryBuilder('client');
    qb.where('client.ownerUserId = :userId', { userId });
    if (query.search?.trim()) {
      qb.andWhere('(client.fullName ILIKE :search OR client.clientExternalId ILIKE :search OR client.email ILIKE :search)', {
        search: `%${query.search.trim()}%`,
      });
    }
    const [items, total] = await qb
      .orderBy('client.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  async getTransactions(query: { page?: number; pageSize?: number; search?: string; clientId?: number; dateFrom?: string; dateTo?: string }, userId: number) {
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
      throw new BadRequestException('Начальная дата фильтра должна быть раньше конечной');
    }
    const page = query.page || 1;
    const pageSize = query.pageSize || 25;
    const qb = this.dataSource.getRepository(Transaction)
      .createQueryBuilder('transaction')
      .innerJoin('transaction.client', 'client');
    qb.where('client.ownerUserId = :userId', { userId });
    if (query.clientId) qb.andWhere('transaction.clientId = :clientId', { clientId: query.clientId });
    if (query.dateFrom) qb.andWhere('transaction.transactionDate >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) qb.andWhere('transaction.transactionDate <= :dateTo', { dateTo: query.dateTo });
    if (query.search?.trim()) {
      qb.andWhere('(client.fullName ILIKE :search OR client.clientExternalId ILIKE :search)', {
        search: `%${query.search.trim()}%`,
      });
    }
    const [items, total] = await qb
      .orderBy('transaction.transactionDate', 'DESC')
      .addOrderBy('transaction.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      items: items.map(transaction => ({ ...transaction, amount: Number(transaction.amount) })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getClientStats(userId: number) {
    const clientsRepository = this.dataSource.getRepository(Client);
    const transactionsRepository = this.dataSource.getRepository(Transaction);
    const totalClients = await clientsRepository.count({ where: { ownerUserId: userId } });
    const totalTransactions = await transactionsRepository
      .createQueryBuilder('transaction')
      .innerJoin('transaction.client', 'client')
      .where('client.ownerUserId = :userId', { userId })
      .getCount();
    const totalRevenue = await transactionsRepository
      .createQueryBuilder('transaction')
      .innerJoin('transaction.client', 'client')
      .select('SUM(transaction.amount)', 'total')
      .where('client.ownerUserId = :userId', { userId })
      .getRawOne();

    return {
      totalClients,
      totalTransactions,
      totalRevenue: totalRevenue?.total || 0,
    };
  }
}
