/**
 * Insurance policies (lesson 2.6). They hold no money: the balance screen keeps them
 * to show what is covered, for how much, and when the cover runs out.
 */

import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { insurancePolicySchema, type InsurancePolicy } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { publishAppEvent } from '@/lib/broadcast';

export interface PolicyInput {
  name: string;
  type: InsurancePolicy['type'];
  insurer?: string;
  sumInsuredMinor?: number;
  premiumMinor?: number;
  startDate?: string;
  endDate: string;
  note?: string;
}

export async function listPolicies(options: { includeArchived?: boolean } = {}): Promise<InsurancePolicy[]> {
  const all = await db.policies.toArray();
  const visible = options.includeArchived ? all : all.filter((policy) => !policy.archived);
  // The one that runs out first is the one worth looking at.
  return visible.sort((a, b) => a.endDate.localeCompare(b.endDate) || a.name.localeCompare(b.name, 'ru'));
}

export async function createPolicy(input: PolicyInput): Promise<InsurancePolicy> {
  const now = Date.now();
  const policy = parseOrThrow(
    insurancePolicySchema,
    { ...input, id: crypto.randomUUID(), archived: false, createdAt: now, updatedAt: now },
    'Полис',
  );

  await db.policies.add(policy);
  publishAppEvent({ type: 'data-changed' });
  return policy;
}

export async function updatePolicy(
  id: string,
  patch: Partial<PolicyInput> & { archived?: boolean },
): Promise<InsurancePolicy> {
  const current = await db.policies.get(id);
  if (!current) throw new RepositoryError('Полис не найден');

  const next = parseOrThrow(
    insurancePolicySchema,
    { ...current, ...patch, id: current.id, createdAt: current.createdAt, updatedAt: Date.now() },
    'Полис',
  );

  await db.policies.put(next);
  publishAppEvent({ type: 'data-changed' });
  return next;
}

export async function deletePolicy(id: string): Promise<void> {
  await db.policies.delete(id);
  publishAppEvent({ type: 'data-changed' });
}
