import { beforeEach, describe, expect, it } from 'vitest';

import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import { RepositoryError, ValidationError } from '@/db/errors';
import { MAX_DOCUMENT_BYTES } from '@/db/models';
import {
  deleteDeductionYear,
  getDeductionYear,
  listDeductionYears,
  saveDeductionYear,
  toDeductionClaim,
  type DeductionYearInput,
} from '@/db/repositories/deductions';
import {
  addDocument,
  deleteDocument,
  documentBlob,
  documentsSizeBytes,
  listDocuments,
  readDocumentContent,
  type DocumentInput,
} from '@/db/repositories/documents';

const RUB = 100;

const noSpending = {
  treatmentMinor: 0,
  educationMinor: 0,
  sportMinor: 0,
  insuranceMinor: 0,
  childEducationMinor: [],
  expensiveTreatmentMinor: 0,
};

function yearInput(year: number, patch: Partial<DeductionYearInput> = {}): DeductionYearInput {
  return {
    year,
    incomeMinor: 1_200_000 * RUB,
    spending: noSpending,
    longTermSavingsMinor: 0,
    status: 'draft',
    ...patch,
  };
}

function bytes(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

function documentInput(patch: Partial<DocumentInput> = {}): DocumentInput {
  return {
    year: 2025,
    category: 'treatment',
    fileName: 'справка об оплате.pdf',
    mimeType: 'application/pdf',
    content: bytes(37, 80, 68, 70),
    ...patch,
  };
}

beforeEach(async () => {
  await clearAllData();
});

describe('deduction years', () => {
  it('keeps one record per year, the newest year first', async () => {
    await saveDeductionYear(yearInput(2023));
    await saveDeductionYear(yearInput(2025));
    await saveDeductionYear(yearInput(2024));

    expect((await listDeductionYears()).map((item) => item.year)).toEqual([2025, 2024, 2023]);
  });

  it('saving a year again replaces it and remembers when it was first made', async () => {
    const first = await saveDeductionYear(yearInput(2025));
    const again = await saveDeductionYear(
      yearInput(2025, {
        incomeMinor: 900_000 * RUB,
        spending: { ...noSpending, sportMinor: 60_000 * RUB, childEducationMinor: [40_000 * RUB] },
        status: 'filed',
      }),
    );

    expect(await db.deductionYears.count()).toBe(1);
    expect(again.createdAt).toBe(first.createdAt);
    expect(again.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
    expect(await getDeductionYear(2025)).toMatchObject({
      incomeMinor: 900_000 * RUB,
      spending: { sportMinor: 60_000 * RUB, childEducationMinor: [40_000 * RUB] },
      status: 'filed',
    });
  });

  it('keeps what the returns of earlier years already took of a home', async () => {
    await saveDeductionYear(
      yearInput(2025, {
        property: {
          purchaseMinor: 4_500_000 * RUB,
          mortgageInterestMinor: 310_000 * RUB,
          loanBefore2014: false,
          usedBeforeMinor: 1_200_000 * RUB,
        },
      }),
    );

    expect((await getDeductionYear(2025))?.property).toEqual({
      purchaseMinor: 4_500_000 * RUB,
      mortgageInterestMinor: 310_000 * RUB,
      loanBefore2014: false,
      usedBeforeMinor: 1_200_000 * RUB,
    });
  });

  it('refuses a year that is not a year, a negative sum and fractional kopecks', async () => {
    await expect(saveDeductionYear(yearInput(25))).rejects.toBeInstanceOf(ValidationError);
    await expect(saveDeductionYear(yearInput(2025, { incomeMinor: -1 }))).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      saveDeductionYear(yearInput(2025, { spending: { ...noSpending, treatmentMinor: 10.5 } })),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await db.deductionYears.count()).toBe(0);
  });

  it('puts treatment, own schooling, sport and insurance into one pot for the law, and keeps the rest apart', async () => {
    const saved = await saveDeductionYear(
      yearInput(2025, {
        spending: {
          treatmentMinor: 40_000 * RUB,
          educationMinor: 30_000 * RUB,
          sportMinor: 20_000 * RUB,
          insuranceMinor: 10_000 * RUB,
          childEducationMinor: [110_000 * RUB],
          expensiveTreatmentMinor: 500_000 * RUB,
        },
        longTermSavingsMinor: 400_000 * RUB,
      }),
    );

    expect(toDeductionClaim(saved)).toEqual({
      incomeMinor: 1_200_000 * RUB,
      social: {
        commonMinor: 100_000 * RUB,
        childEducationMinor: [110_000 * RUB],
        expensiveTreatmentMinor: 500_000 * RUB,
      },
      longTermSavingsMinor: 400_000 * RUB,
      property: undefined,
    });
  });

  it('deleting a year takes its documents with it, and leaves the other years alone', async () => {
    await saveDeductionYear(yearInput(2024));
    await saveDeductionYear(yearInput(2025));
    await addDocument(documentInput({ year: 2024 }));
    await addDocument(documentInput({ year: 2025 }));

    await deleteDeductionYear(2024);

    expect((await listDeductionYears()).map((item) => item.year)).toEqual([2025]);
    expect((await listDocuments()).map((item) => item.year)).toEqual([2025]);
    // and the bytes of the deleted ones do not linger unseen
    expect(await db.documentFiles.count()).toBe(1);
  });
});

describe('documents', () => {
  it('keeps the bytes of a file exactly as they were', async () => {
    const saved = await addDocument(documentInput({ content: bytes(0, 1, 127, 128, 255) }));
    const content = await readDocumentContent(saved.id);

    expect([...new Uint8Array(content!)]).toEqual([0, 1, 127, 128, 255]);
    expect(saved.sizeBytes).toBe(5);
  });

  it('lists documents without reading their bytes', async () => {
    // a list of thirty scans must not pull thirty scans into memory
    await addDocument(documentInput());
    const [listed] = await listDocuments(2025);

    expect(listed.fileName).toBe('справка об оплате.pdf');
    expect('content' in listed).toBe(false);
  });

  it('gives a document back as a file of its own type', async () => {
    const saved = await addDocument(documentInput({ content: bytes(1, 2, 3), mimeType: 'image/jpeg' }));
    const blob = await documentBlob(saved);

    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBe(3);
  });

  it('says so when the bytes of a document are gone, instead of handing over an empty file', async () => {
    const saved = await addDocument(documentInput());
    await db.documentFiles.delete(saved.id);

    await expect(documentBlob(saved)).rejects.toBeInstanceOf(RepositoryError);
  });

  it('counts the size from the bytes, not from what it was told', async () => {
    const saved = await addDocument(documentInput({ content: bytes(1, 2, 3, 4, 5, 6) }));

    expect(saved.sizeBytes).toBe(6);
  });

  it('names an unknown type plainly instead of leaving it empty', async () => {
    const saved = await addDocument(documentInput({ mimeType: '' }));

    expect(saved.mimeType).toBe('application/octet-stream');
  });

  it('lists the documents of one year, or of all years', async () => {
    await addDocument(documentInput({ year: 2024, fileName: 'договор.pdf' }));
    await addDocument(documentInput({ year: 2025, fileName: 'чек.jpg' }));

    expect((await listDocuments(2024)).map((item) => item.fileName)).toEqual(['договор.pdf']);
    expect(await listDocuments()).toHaveLength(2);
  });

  it('refuses an empty file and a file over the limit', async () => {
    await expect(addDocument(documentInput({ content: new ArrayBuffer(0) }))).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      addDocument(documentInput({ content: new ArrayBuffer(MAX_DOCUMENT_BYTES + 1) })),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await db.documents.count()).toBe(0);
    expect(await db.documentFiles.count()).toBe(0);
  });

  it('accepts a file exactly at the limit', async () => {
    const saved = await addDocument(documentInput({ content: new ArrayBuffer(MAX_DOCUMENT_BYTES) }));

    expect(saved.sizeBytes).toBe(MAX_DOCUMENT_BYTES);
  });

  it('adds up how much room the documents take', async () => {
    await addDocument(documentInput({ content: bytes(1, 2, 3) }));
    await addDocument(documentInput({ content: bytes(4, 5) }));

    expect(await documentsSizeBytes()).toBe(5);
  });

  it('deletes one document', async () => {
    const saved = await addDocument(documentInput());
    await deleteDocument(saved.id);

    expect(await db.documents.count()).toBe(0);
    expect(await db.documentFiles.count()).toBe(0);
    expect(await readDocumentContent(saved.id)).toBeUndefined();
  });
});
