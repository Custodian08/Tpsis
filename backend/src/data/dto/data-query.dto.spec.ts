import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataQueryDto } from './data-query.dto';

describe('DataQueryDto', () => {
  it('converts pagination query strings into bounded numbers', async () => {
    const query = plainToInstance(DataQueryDto, { page: '2', pageSize: '50' });

    expect(query.page).toBe(2);
    expect(query.pageSize).toBe(50);
    await expect(validate(query)).resolves.toHaveLength(0);
  });

  it('rejects oversized pages and impossible calendar dates', async () => {
    const query = plainToInstance(DataQueryDto, { pageSize: '101', dateFrom: '2026-02-30' });
    const errors = await validate(query);

    expect(errors.map(error => error.property)).toEqual(expect.arrayContaining(['pageSize', 'dateFrom']));
  });

  it('rejects non-integer pagination values', async () => {
    const query = plainToInstance(DataQueryDto, { page: '1.5' });
    const errors = await validate(query);

    expect(errors.some(error => error.property === 'page')).toBe(true);
  });
});
