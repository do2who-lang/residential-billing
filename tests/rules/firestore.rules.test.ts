import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-building-ledger';
const PROJECT_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const RULES = readFileSync(path.join(PROJECT_ROOT, 'firestore.rules'), 'utf8');

// Seed data identities.
const ADMIN = 'admin1';
const RESIDENT_1 = 'res1'; // owns apt-1
const RESIDENT_2 = 'res2'; // owns apt-2
const INACTIVE = 'res3'; // profile exists but active == false
const NO_PROFILE = 'nobody'; // authenticates but has no users/{uid} document
const NEW_RESIDENT = 'res4'; // created by the admin during the tests

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: RULES,
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

/** Seeds the fixtures with rules disabled (this is the "trusted" path). */
async function seed(): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const batch: Array<[string, Record<string, unknown>]> = [
      [`users/${ADMIN}`, { role: 'admin', active: true, apartmentId: null, phone: '+962791234567' }],
      [`users/${RESIDENT_1}`, { role: 'resident', active: true, apartmentId: 'apt-1' }],
      [`users/${RESIDENT_2}`, { role: 'resident', active: true, apartmentId: 'apt-2' }],
      [`users/${INACTIVE}`, { role: 'resident', active: false, apartmentId: 'apt-1' }],
      ['settings/building', { name: 'My Building', currency: 'JOD', defaultLang: 'en' }],
      ['apartments/apt-1', { name: 'Apartment 1', archived: false, order: 0 }],
      ['apartments/apt-2', { name: 'Apartment 2', archived: false, order: 1 }],
      ['services/water', { nameEn: 'Water', nameAr: 'ماء', archived: false, order: 0 }],
      ['periods/2026-01', { year: 2026, month: 1, status: 'open' }],
      ['periods/2026-01/charges/apt-1', { apartmentId: 'apt-1', amountsMinor: { water: 5000 } }],
      ['periods/2026-01/charges/apt-2', { apartmentId: 'apt-2', amountsMinor: { water: 7000 } }],
      [
        'payments/pay-1',
        {
          periodId: '2026-01',
          apartmentId: 'apt-1',
          serviceId: 'water',
          amountMinor: 5000,
          method: 'cash',
        },
      ],
      [
        'payments/pay-2',
        {
          periodId: '2026-01',
          apartmentId: 'apt-2',
          serviceId: 'water',
          amountMinor: 1000,
          method: 'cash',
        },
      ],
    ];

    for (const [pathname, data] of batch) {
      await setDoc(doc(db, pathname), data);
    }
  });
}

const adminDb = () => testEnv.authenticatedContext(ADMIN).firestore();
const resident1Db = () => testEnv.authenticatedContext(RESIDENT_1).firestore();
const resident2Db = () => testEnv.authenticatedContext(RESIDENT_2).firestore();
const inactiveDb = () => testEnv.authenticatedContext(INACTIVE).firestore();
const noProfileDb = () => testEnv.authenticatedContext(NO_PROFILE).firestore();
const anonDb = () => testEnv.unauthenticatedContext().firestore();

const validPayment = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  periodId: '2026-01',
  apartmentId: 'apt-1',
  serviceId: 'water',
  amountMinor: 2500,
  method: 'bank',
  note: '',
  recordedBy: ADMIN,
  ...overrides,
});

describe('unauthenticated access', () => {
  beforeEach(seed);

  it('denies every collection', async () => {
    const db = anonDb();
    await assertFails(getDoc(doc(db, 'settings/building')));
    await assertFails(getDoc(doc(db, 'apartments/apt-1')));
    await assertFails(getDoc(doc(db, 'services/water')));
    await assertFails(getDoc(doc(db, 'periods/2026-01')));
    await assertFails(getDoc(doc(db, 'periods/2026-01/charges/apt-1')));
    await assertFails(getDoc(doc(db, 'payments/pay-1')));
    await assertFails(getDoc(doc(db, 'users', RESIDENT_1)));
  });
});

describe('signed in without a profile', () => {
  beforeEach(seed);

  it('can read its own (non-existent) profile so the app can show a notice', async () => {
    await assertSucceeds(getDoc(doc(noProfileDb(), 'users', NO_PROFILE)));
  });

  it('cannot read building data', async () => {
    const db = noProfileDb();
    await assertFails(getDoc(doc(db, 'settings/building')));
    await assertFails(getDoc(doc(db, 'apartments/apt-1')));
    await assertFails(getDoc(doc(db, 'services/water')));
    await assertFails(getDoc(doc(db, 'periods/2026-01')));
  });

  it('cannot read another profile', async () => {
    await assertFails(getDoc(doc(noProfileDb(), 'users', RESIDENT_1)));
  });
});

describe('deactivated profile', () => {
  beforeEach(seed);

  it('loses access to building data even though it owns an apartment', async () => {
    const db = inactiveDb();
    await assertFails(getDoc(doc(db, 'settings/building')));
    await assertFails(getDoc(doc(db, 'apartments/apt-1')));
    await assertFails(getDoc(doc(db, 'services/water')));
    await assertFails(getDoc(doc(db, 'periods/2026-01/charges/apt-1')));
  });
});

describe('admin', () => {
  beforeEach(seed);

  it('reads every collection', async () => {
    const db = adminDb();
    await assertSucceeds(getDoc(doc(db, 'settings/building')));
    await assertSucceeds(getDoc(doc(db, 'apartments/apt-1')));
    await assertSucceeds(getDoc(doc(db, 'services/water')));
    await assertSucceeds(getDoc(doc(db, 'periods/2026-01')));
    await assertSucceeds(getDoc(doc(db, 'periods/2026-01/charges/apt-2')));
    await assertSucceeds(getDocs(collection(db, 'payments')));
    await assertSucceeds(getDocs(collection(db, 'users')));
  });

  it('writes apartments, services, periods, charges and settings', async () => {
    const db = adminDb();
    await assertSucceeds(setDoc(doc(db, 'apartments/apt-9'), { name: 'New', order: 9 }));
    await assertSucceeds(setDoc(doc(db, 'services/generator'), { nameEn: 'Generator', order: 2 }));
    await assertSucceeds(setDoc(doc(db, 'periods/2026-02'), { year: 2026, month: 2 }));
    await assertSucceeds(
      setDoc(doc(db, 'periods/2026-02/charges/apt-1'), {
        apartmentId: 'apt-1',
        amountsMinor: { water: 1000 },
      }),
    );
    await assertSucceeds(updateDoc(doc(db, 'settings/building'), { name: 'Renamed' }));
  });

  it('records a well-formed payment', async () => {
    await assertSucceeds(setDoc(doc(adminDb(), 'payments/new-pay'), validPayment()));
  });

  it('rejects payments that fail validation', async () => {
    const db = adminDb();
    await assertFails(setDoc(doc(db, 'payments/bad-1'), validPayment({ amountMinor: 0 })));
    await assertFails(setDoc(doc(db, 'payments/bad-2'), validPayment({ amountMinor: -100 })));
    await assertFails(setDoc(doc(db, 'payments/bad-3'), validPayment({ amountMinor: '2500' })));
    await assertFails(setDoc(doc(db, 'payments/bad-4'), validPayment({ periodId: 202601 })));
    await assertFails(setDoc(doc(db, 'payments/bad-5'), validPayment({ apartmentId: null })));

    const missingService = validPayment();
    delete missingService.serviceId;
    await assertFails(setDoc(doc(db, 'payments/bad-6'), missingService));
  });

  it('invites a resident and manages their profile', async () => {
    const db = adminDb();
    await assertSucceeds(
      setDoc(doc(db, 'users', NEW_RESIDENT), {
        phone: '+962781234567',
        displayName: 'New Resident',
        role: 'resident',
        apartmentId: 'apt-2',
        active: true,
      }),
    );
    await assertSucceeds(updateDoc(doc(db, 'users', NEW_RESIDENT), { active: false }));
  });

  it('deletes active and inactive resident profiles without deleting apartment history', async () => {
    const db = adminDb();
    const historyRefs = [
      doc(db, 'apartments/apt-1'),
      doc(db, 'periods/2026-01/charges/apt-1'),
      doc(db, 'payments/pay-1'),
    ];
    const before = await Promise.all(historyRefs.map(async (reference) => (await getDoc(reference)).data()));
    await assertSucceeds(deleteDoc(doc(db, 'users', RESIDENT_1)));
    await assertSucceeds(deleteDoc(doc(db, 'users', INACTIVE)));
    expect((await getDoc(doc(db, 'users', RESIDENT_1))).exists()).toBe(false);
    expect((await getDoc(doc(db, 'users', INACTIVE))).exists()).toBe(false);
    for (const [index, reference] of historyRefs.entries()) {
      expect((await getDoc(reference)).data()).toEqual(before[index]);
    }
    expect((await getDoc(doc(resident1Db(), 'users', RESIDENT_1))).exists()).toBe(false);
    await assertFails(getDoc(doc(resident1Db(), 'apartments/apt-1')));
    await assertFails(getDoc(doc(resident1Db(), 'payments/pay-1')));
    await assertFails(setDoc(doc(resident1Db(), 'users', RESIDENT_1), {
      role: 'resident',
      active: true,
      apartmentId: 'apt-1',
    }));
  });

  it('protects the signed-in profile and other administrator profiles', async () => {
    await assertFails(deleteDoc(doc(adminDb(), 'users', ADMIN)));
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'other-admin'), { role: 'admin', active: true });
    });
    await assertFails(deleteDoc(doc(adminDb(), 'users', 'other-admin')));
  });

  it('rejects deletion by anonymous, profileless, and inactive administrator accounts', async () => {
    await assertFails(deleteDoc(doc(anonDb(), 'users', RESIDENT_1)));
    await assertFails(deleteDoc(doc(noProfileDb(), 'users', RESIDENT_1)));
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', ADMIN), {
        active: false,
      });
    });
    await assertFails(deleteDoc(doc(adminDb(), 'users', RESIDENT_1)));
  });
});

describe('resident', () => {
  beforeEach(seed);

  it('cannot delete its own profile or another account', async () => {
    await assertFails(deleteDoc(doc(resident1Db(), 'users', RESIDENT_1)));
    await assertFails(deleteDoc(doc(resident1Db(), 'users', RESIDENT_2)));
  });

  it('reads its own apartment but not the neighbours', async () => {
    await assertSucceeds(getDoc(doc(resident1Db(), 'apartments/apt-1')));
    await assertFails(getDoc(doc(resident1Db(), 'apartments/apt-2')));
  });

  it('cannot list the apartment collection', async () => {
    await assertFails(getDocs(collection(resident1Db(), 'apartments')));
  });

  it('reads shared reference data', async () => {
    const db = resident1Db();
    await assertSucceeds(getDoc(doc(db, 'services/water')));
    await assertSucceeds(getDoc(doc(db, 'periods/2026-01')));
    await assertSucceeds(getDoc(doc(db, 'settings/building')));
  });

  it('reads its own charge document only', async () => {
    await assertSucceeds(getDoc(doc(resident1Db(), 'periods/2026-01/charges/apt-1')));
    await assertFails(getDoc(doc(resident1Db(), 'periods/2026-01/charges/apt-2')));
  });

  it('reads the charge history through a constrained collection-group query', async () => {
    const own = query(collectionGroup(resident1Db(), 'charges'), where('apartmentId', '==', 'apt-1'));
    await assertSucceeds(getDocs(own));

    const other = query(
      collectionGroup(resident2Db(), 'charges'),
      where('apartmentId', '==', 'apt-1'),
    );
    await assertFails(getDocs(other));
  });

  it('reads its own payments only', async () => {
    const own = query(
      collection(resident1Db(), 'payments'),
      where('apartmentId', '==', 'apt-1'),
    );
    await assertSucceeds(getDocs(own));

    await assertFails(getDocs(collection(resident1Db(), 'payments')));
    await assertFails(getDoc(doc(resident1Db(), 'payments/pay-2')));
  });

  it('cannot write building data', async () => {
    const db = resident1Db();
    await assertFails(setDoc(doc(db, 'apartments/apt-3'), { name: 'Mine' }));
    await assertFails(updateDoc(doc(db, 'apartments/apt-1'), { name: 'Hacked' }));
    await assertFails(setDoc(doc(db, 'services/free'), { nameEn: 'Free' }));
    await assertFails(
      setDoc(doc(db, 'periods/2026-01/charges/apt-1'), {
        apartmentId: 'apt-1',
        amountsMinor: { water: 0 },
      }),
    );
    await assertFails(setDoc(doc(db, 'payments/self'), validPayment()));
    await assertFails(updateDoc(doc(db, 'settings/building'), { name: 'Hijacked' }));
  });

  it('cannot escalate its own role or deactivate itself into another apartment', async () => {
    const db = resident1Db();
    await assertFails(updateDoc(doc(db, 'users', RESIDENT_1), { role: 'admin' }));
    await assertFails(updateDoc(doc(db, 'users', RESIDENT_1), { apartmentId: 'apt-2' }));
    await assertFails(setDoc(doc(db, 'users', 'ghost'), { role: 'admin', active: true }));
  });

  it('cannot read other profiles', async () => {
    await assertFails(getDoc(doc(resident1Db(), 'users', RESIDENT_2)));
    await assertSucceeds(getDoc(doc(resident1Db(), 'users', RESIDENT_1)));
  });
});

describe('rules file sanity', () => {
  it('declares the expected collections', () => {
    for (const name of ['settings', 'users', 'apartments', 'services', 'periods', 'payments']) {
      expect(RULES).toContain(`match /${name}/`);
    }
    expect(RULES).toContain('charges');
  });
});
