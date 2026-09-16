import { beforeEach, describe, expect, it } from 'vitest';

import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import { RepositoryError, ValidationError } from '@/db/errors';
import { createPolicy, deletePolicy, listPolicies, updatePolicy } from '@/db/repositories/policies';

const RUB = 100;

beforeEach(async () => {
  await clearAllData();
});

describe('insurance policies', () => {
  it('puts the one that runs out first at the top', async () => {
    await createPolicy({ name: 'КАСКО', type: 'vehicle', endDate: '2027-03-01' });
    await createPolicy({
      name: 'ОСАГО',
      type: 'vehicle',
      insurer: 'Страховая',
      sumInsuredMinor: 400_000 * RUB,
      premiumMinor: 9_000 * RUB,
      endDate: '2026-11-20',
    });

    const policies = await listPolicies();
    expect(policies.map((policy) => policy.name)).toEqual(['ОСАГО', 'КАСКО']);
    expect(policies[0].sumInsuredMinor).toBe(400_000 * RUB);
  });

  it('refuses a policy without an end date or with a broken one', async () => {
    await expect(
      createPolicy({ name: 'Полис', type: 'life', endDate: 'когда-нибудь' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(createPolicy({ name: '  ', type: 'life', endDate: '2027-01-01' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('changes a policy and hides an archived one', async () => {
    const policy = await createPolicy({ name: 'ДМС', type: 'health', endDate: '2027-01-01' });

    const renamed = await updatePolicy(policy.id, { name: 'ДМС семьи', premiumMinor: 30_000 * RUB });
    expect(renamed.name).toBe('ДМС семьи');
    expect(renamed.createdAt).toBe(policy.createdAt);

    await updatePolicy(policy.id, { archived: true });
    expect(await listPolicies()).toHaveLength(0);
    expect(await listPolicies({ includeArchived: true })).toHaveLength(1);
  });

  it('reports a policy that is not there, and deletes one that is', async () => {
    await expect(updatePolicy('нет-такого', { name: 'Что-то' })).rejects.toBeInstanceOf(RepositoryError);

    const policy = await createPolicy({ name: 'Квартира', type: 'property', endDate: '2027-06-01' });
    await deletePolicy(policy.id);
    expect(await db.policies.count()).toBe(0);
  });
});
