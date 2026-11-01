import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import { DataService } from './data.service';
import { Client } from './entities/client.entity';
import { Transaction } from './entities/transaction.entity';

describe('DataService imports', () => {
  let service: DataService;
  let dataSource: { transaction: jest.Mock };
  let clients: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let transactions: { create: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    clients = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(value => value),
      save: jest.fn(async values => values.map((value, index) => ({ ...value, id: index + 1 }))),
    };
    transactions = {
      create: jest.fn(value => value),
      save: jest.fn(async values => values),
    };
    dataSource = {
      transaction: jest.fn(async callback => callback({
        getRepository: (entity: unknown) => entity === Client ? clients : transactions,
      })),
    };
    service = new DataService(dataSource as unknown as DataSource);
  });

  it('imports CSV and creates one client for repeated external IDs', async () => {
    const content = [
      'client_id,transaction_date,amount,full_name',
      'c-1,2026-03-01,12.50,Алексей',
      'c-1,2026-03-02,7.25,Алексей',
    ].join('\n');
    const buffer = Buffer.from(content, 'utf8');

    const result = await service.importFromCSV({
      originalname: 'transactions.csv',
      size: buffer.length,
      buffer,
    } as Express.Multer.File, 42);

    expect(result).toEqual({ clientsImported: 1, transactionsImported: 2, errors: 0 });
    expect(clients.save).toHaveBeenCalledTimes(1);
    expect(clients.save.mock.calls[0][0][0].ownerUserId).toBe(42);
    expect(transactions.save).toHaveBeenCalledTimes(1);
    expect(transactions.save.mock.calls[0][0]).toHaveLength(2);
  });

  it('previews CSV rows without writing them to the database', async () => {
    const content = [
      'client_id,transaction_date,amount,full_name',
      'c-1,2026-03-01,12.50,Алексей',
      'c-1,2026-03-02,7.25,Алексей',
    ].join('\n');
    const buffer = Buffer.from(content, 'utf8');

    const preview = await service.previewFromCSV({
      originalname: 'transactions.csv',
      size: buffer.length,
      buffer,
    } as Express.Multer.File, 42);

    expect(preview).toMatchObject({
      clientsInFile: 1,
      transactionsInFile: 2,
      dateFrom: '2026-03-01',
      dateTo: '2026-03-02',
    });
    expect('sampleRows' in preview && preview.sampleRows).toHaveLength(2);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('reads Windows-1251 semicolon-separated CSV exported from a Cyrillic spreadsheet', async () => {
    const buffer = Buffer.concat([
      Buffer.from('client_id;transaction_date;amount;full_name\nc-2;2026-03-04;15.00;', 'ascii'),
      Buffer.from([0xc0, 0xeb, 0xe5, 0xea, 0xf1, 0xe5, 0xe9]), // Алексей in Windows-1251
      Buffer.from('\n', 'ascii'),
    ]);
    const preview = await service.previewFromCSV({
      originalname: 'transactions.csv',
      size: buffer.length,
      buffer,
    } as Express.Multer.File, 42);

    expect('sampleRows' in preview && preview.sampleRows[0].fullName).toBe('Алексей');
    expect('clientsInFile' in preview && preview.clientsInFile).toBe(1);
  });

  it('reads UTF-16LE BOM CSV using a tab separator', async () => {
    const text = 'client_id\ttransaction_date\tamount\nc-3\t2026-03-05\t8.25\n';
    const buffer = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
    const preview = await service.previewFromCSV({
      originalname: 'transactions.csv',
      size: buffer.length,
      buffer,
    } as Express.Multer.File, 42);

    expect(preview).toMatchObject({ clientsInFile: 1, transactionsInFile: 1 });
  });

  it('imports Excel rows through the same validation and storage transaction', async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['client_id', 'transaction_date', 'amount', 'items_count'],
      ['excel-1', '2026-04-15', '31.40', 2],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Transactions');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const result = await service.importFromExcel({
      originalname: 'transactions.xlsx',
      size: buffer.length,
      buffer,
    } as Express.Multer.File, 42);

    expect(result).toEqual({ clientsImported: 1, transactionsImported: 1, errors: 0 });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid row before opening a database transaction', async () => {
    const content = 'client_id,transaction_date,amount\nc-1,2026-02-30,15.00';
    const buffer = Buffer.from(content, 'utf8');

    await expect(service.importFromCSV({
      originalname: 'transactions.csv',
      size: buffer.length,
      buffer,
    } as Express.Multer.File, 42)).rejects.toThrow(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a file whose extension does not match the import format', async () => {
    await expect(service.importFromCSV({
      originalname: 'transactions.txt',
      size: 4,
      buffer: Buffer.from('data'),
    } as Express.Multer.File, 42)).rejects.toThrow('Ожидается файл формата .csv');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
