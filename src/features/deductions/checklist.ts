/**
 * The papers a return needs, from what the questions say was there (lesson 3.7). Only what
 * applies is listed: a person who paid for sport is not asked for a mortgage statement.
 */

import { homeSaleIncomeMinor } from '@/core/deductions';
import type { YearRules } from '@/core/rules';
import type { DocumentCategory } from '@/db/models';
import type { DeductionYearInput } from '@/db/repositories/deductions';
import type { ru } from '@/i18n/ru';

type Texts = (typeof ru)['deductions']['checklist'];

export type ChecklistGroupId = keyof Texts['groups'];
export type ChecklistItemId = keyof Texts['items'];

export interface ChecklistGroup {
  readonly id: ChecklistGroupId;
  /** Where papers of this kind are kept among the documents of the year. */
  readonly category: DocumentCategory;
  readonly items: readonly ChecklistItemId[];
  /** One certificate stands for the rest, and even that is not needed if the organization sent it. */
  readonly certificate: boolean;
}

type Answers = Pick<
  DeductionYearInput,
  'spending' | 'longTermSavingsMinor' | 'property' | 'children' | 'sale'
>;

export function checklistFor(answers: Answers, rules: YearRules | undefined): ChecklistGroup[] {
  const { spending, children, property, sale } = answers;
  // Until 2024, and for a year the app has no rules for, the lesson's full set is the safe answer.
  const certificates = rules?.socialPaymentCertificates.value ?? false;

  const groups: ChecklistGroup[] = [];
  const add = (
    id: ChecklistGroupId,
    category: DocumentCategory,
    items: ChecklistItemId[],
    certificate = false,
  ) => groups.push({ id, category, items, certificate });

  const treatment = spending.treatmentMinor > 0;
  const expensive = spending.expensiveTreatmentMinor > 0;
  const childSchooling = spending.childEducationMinor.some((paid) => paid > 0);

  if (treatment || expensive) {
    if (certificates) add('treatment', 'treatment', ['treatmentCertificate'], true);
    else add('treatment', 'treatment', ['treatmentContract', 'treatmentCertificate', 'treatmentLicense']);
  }
  if (treatment) add('medicine', 'medicine', ['prescription', 'medicineReceipts']);

  if (spending.insuranceMinor > 0) {
    if (certificates) add('insurance', 'insurance', ['insuranceCertificate'], true);
    else add('insurance', 'insurance', ['insuranceContract', 'insuranceLicense', 'insuranceReceipts']);
  }

  if (spending.educationMinor > 0) {
    if (certificates) add('education', 'schooling', ['educationCertificate'], true);
    else add('education', 'schooling', ['educationContract', 'educationLicense', 'educationReceipts']);
  }

  if (childSchooling) {
    if (certificates) add('childEducation', 'child_schooling', ['educationCertificate'], true);
    else
      add('childEducation', 'child_schooling', [
        'educationContract',
        'educationLicense',
        'educationReceipts',
        'fullTime',
      ]);
  }

  if (spending.sportMinor > 0) {
    if (certificates) add('sport', 'sport', ['sportCertificate'], true);
    else add('sport', 'sport', ['sportContract', 'sportReceipts']);
  }

  if (
    treatment ||
    expensive ||
    childSchooling ||
    spending.educationMinor > 0 ||
    spending.insuranceMinor > 0 ||
    spending.sportMinor > 0
  ) {
    add('relatives', 'children', ['birthCertificates', 'marriageCertificate']);
  }

  if (answers.longTermSavingsMinor > 0)
    add('savings', 'long_term_savings', ['savingsContract', 'savingsPayments']);

  // Given by the employer, the child deduction is already in the income statement.
  if (children && !children.appliedByEmployer) {
    add('kids', 'children', [
      'kidsBirth',
      ...(children.items.some((kid) => kid.disabled) ? (['kidsDisability'] as const) : []),
      'kidsStudent',
      ...(children.double ? (['kidsDouble'] as const) : []),
    ]);
  }

  if (property) {
    add('property', 'property', ['purchaseContract', 'transferAct', 'ownership', 'purchasePayments']);
    if (property.mortgageInterestMinor > 0)
      add('mortgage', 'mortgage', ['loanContract', 'interestStatement']);
  }

  // A sale owned long enough, or within the fixed deduction, needs no return at all.
  if (
    sale &&
    !sale.ownedLongEnough &&
    (!rules || homeSaleIncomeMinor(sale, rules) > rules.homeSale.value.deductionLimitMinor)
  ) {
    add('sale', 'property_sale', [
      'saleContract',
      'salePayment',
      ...(sale.expensesMinor > 0 ? (['saleExpenses'] as const) : []),
    ]);
  }

  if (groups.length === 0) return groups;
  return [
    {
      id: 'general',
      category: 'income',
      items: ['passport', 'declaration', 'incomeStatement', 'bankDetails'],
      certificate: false,
    },
    ...groups,
  ];
}
