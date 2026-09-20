import { describe, it, expect } from 'vitest';
import {
  getAllWilayas,
  getCommunesByWilaya,
  getAllCities,
  isValidWilaya,
  isValidCommune,
} from '../data';

describe('Geographic Selectors', () => {
  it('getAllWilayas returns array of wilayas', () => {
    const wilayas = getAllWilayas();
    expect(Array.isArray(wilayas)).toBe(true);
    expect(wilayas).toContain('الجزائر');
    expect(wilayas).toContain('وهران');
    expect(wilayas).toContain('قسنطينة');
  });

  it('getCommunesByWilaya returns communes for specified wilaya', () => {
    const algCommunes = getCommunesByWilaya('الجزائر');
    expect(algCommunes).toContain('باب الزوار');
    expect(algCommunes).toContain('حيدرة');

    // Empty / 'الكل' / unknown
    expect(getCommunesByWilaya('الكل')).toEqual([]);
    expect(getCommunesByWilaya('Unknown')).toEqual([]);
    expect(getCommunesByWilaya(null)).toEqual([]);
    expect(getCommunesByWilaya(undefined)).toEqual([]);
  });

  it('getAllCities flattens all communes into a single list', () => {
    const cities = getAllCities();
    expect(cities.length).toBeGreaterThan(50);
    expect(cities).toContain('باب الزوار');
    expect(cities).toContain('السانية');
  });

  it('isValidWilaya validates existence of Wilaya', () => {
    expect(isValidWilaya('الجزائر')).toBe(true);
    expect(isValidWilaya('سطيف')).toBe(true);
    expect(isValidWilaya('NonExistentWilaya')).toBe(false);
    expect(isValidWilaya('')).toBe(false);
    expect(isValidWilaya(null)).toBe(false);
  });

  it('isValidCommune validates existence of Commune scoped or unscoped', () => {
    // Scoped to Wilaya
    expect(isValidCommune('باب الزوار', 'الجزائر')).toBe(true);
    expect(isValidCommune('باب الزوار', 'وهران')).toBe(false); // Commune doesn't belong to Oran

    // Unscoped
    expect(isValidCommune('باب الزوار')).toBe(true);
    expect(isValidCommune('السانية')).toBe(true);
    expect(isValidCommune('FakeCommune')).toBe(false);
    expect(isValidCommune('')).toBe(false);
    expect(isValidCommune(null)).toBe(false);
  });
});
